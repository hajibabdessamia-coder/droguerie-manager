import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddPaymentDto } from './dto/add-payment.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  findAll(search?: string) {
    return this.prisma.customer.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        sales: { orderBy: { createdAt: 'desc' }, take: 50, include: { items: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!customer) throw new NotFoundException('الزبون غير موجود');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.customer.delete({ where: { id } });
  }

  async addPayment(id: string, dto: AddPaymentDto) {
    await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.create({
        data: { customerId: id, amount: dto.amount, note: dto.note },
      });
      await tx.customer.update({ where: { id }, data: { balance: { decrement: dto.amount } } });
      return payment;
    });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.customer.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('الزبون غير موجود');
  }
}
