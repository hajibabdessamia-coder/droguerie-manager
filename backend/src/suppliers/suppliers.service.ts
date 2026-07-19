import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddPaymentDto } from './dto/add-payment.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  findAll(search?: string) {
    return this.prisma.supplier.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: { orderBy: { date: 'desc' }, take: 50, include: { items: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!supplier) throw new NotFoundException('المورد غير موجود');
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.ensureExists(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.supplier.delete({ where: { id } });
  }

  async addPayment(id: string, dto: AddPaymentDto) {
    await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: { supplierId: id, amount: dto.amount, note: dto.note },
      });
      await tx.supplier.update({ where: { id }, data: { balance: { decrement: dto.amount } } });
      return payment;
    });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.supplier.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('المورد غير موجود');
  }
}
