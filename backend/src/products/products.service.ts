import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { generateEan13Candidate } from './barcode.util';

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
          { barcode: { contains: query.search } },
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
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND' });
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

  // يولّد باركود EAN-13 عشوائياً (ضمن نطاق الاستخدام الداخلي المحجوز) ويتحقق من عدم
  // تصادمه مع باركود موجود مسبقاً قبل إرجاعه — احتمال التصادم ضئيل جداً (10 خانات
  // عشوائية) لكن التحقق يبقيه مضموناً 100% بدل الاعتماد على الاحتمال وحده
  async generateUniqueBarcode(): Promise<{ barcode: string }> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generateEan13Candidate();
      const existing = await this.prisma.product.findUnique({ where: { barcode: candidate } });
      if (!existing) return { barcode: candidate };
    }
    // احتمال شبه مستحيل عملياً (20 محاولة متتالية بلا نجاح) — رغم ذلك يُعاد آخر قيمة
    // مولَّدة كي لا تفشل العملية بالكامل؛ فحص @unique في قاعدة البيانات يبقى خط الدفاع الأخير
    return { barcode: generateEan13Candidate() };
  }
}
