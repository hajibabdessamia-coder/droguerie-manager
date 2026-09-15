import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async findAll(query: QueryProductDto) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      categoryId: query.categoryId,
      manufacturerId: query.manufacturerId,
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { internalCode: { contains: query.search } },
        ],
      }),
    };

    const products = await this.prisma.product.findMany({
      where,
      include: { manufacturer: true, category: true, unit: true },
      orderBy: { name: 'asc' },
    });

    return query.lowStock === 'true' ? products.filter((p) => p.quantity <= p.minStock) : products;
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { manufacturer: true, category: true, unit: true },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // حذف ناعم: يبقي المنتج في سجلات المبيعات القديمة لكنه يختفي من نقطة البيع
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: { quantity: { increment: dto.delta } },
      });
      await tx.stockMovement.create({
        data: { productId: id, type: 'ADJUSTMENT', quantity: dto.delta, reason: dto.reason },
      });
      return product;
    });
  }

  async lowStock() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { manufacturer: true, category: true, unit: true },
      orderBy: { name: 'asc' },
    });
    return products.filter((p) => p.quantity <= p.minStock);
  }
}
