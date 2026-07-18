import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreatePurchaseDto) {
    const total = dto.items.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0);

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId: dto.supplierId,
          userId,
          invoiceRef: dto.invoiceRef,
          total,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              purchasePrice: item.purchasePrice,
              total: item.quantity * item.purchasePrice,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of dto.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity }, purchasePrice: item.purchasePrice },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'PURCHASE',
            quantity: item.quantity,
            reason: `شراء #${purchase.id}`,
          },
        });
      }

      await tx.supplier.update({ where: { id: dto.supplierId }, data: { balance: { increment: total } } });

      return purchase;
    });
  }

  findAll() {
    return this.prisma.purchase.findMany({
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: true } } },
    });
    if (!purchase) throw new NotFoundException('فاتورة الشراء غير موجودة');
    return purchase;
  }
}
