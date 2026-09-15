import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async create(sellerId: string, dto: CreateSaleDto) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let grantedBy: string | undefined;
    if (dto.items.some((i) => i.priceType === 'CUSTOM')) {
      grantedBy = this.verifyOverrideToken(dto.overrideToken);
    }

    let subtotal = 0;
    const itemsData = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new NotFoundException(`منتج غير موجود: ${item.productId}`);
      if (product.quantity < item.quantity) {
        throw new BadRequestException(`الكمية غير متوفرة للمنتج: ${product.name}`);
      }

      let unitPrice: number;
      if (item.priceType === 'CUSTOM') {
        if (item.customPrice === undefined) throw new BadRequestException('السعر المخصص مطلوب');
        unitPrice = item.customPrice;
      } else if (item.priceType === 'WHOLESALE') {
        unitPrice = Number(product.wholesalePrice);
      } else {
        unitPrice = Number(product.retailPrice);
      }

      const total = unitPrice * item.quantity;
      subtotal += total;
      return { productId: item.productId, quantity: item.quantity, unitPrice, priceType: item.priceType, total };
    });

    const discount = dto.discount ?? 0;
    const taxable = subtotal - discount;
    const taxAmount = taxable * ((dto.taxRate ?? 0) / 100);
    const total = taxable + taxAmount;
    const changeDue = Math.max(0, dto.amountPaid - total);

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.nextInvoiceNumber(tx);

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          invoiceType: dto.invoiceType,
          customerId: dto.customerId,
          sellerId,
          subtotal,
          discount,
          taxRate: dto.taxRate ?? 0,
          taxAmount,
          total,
          amountPaid: dto.amountPaid,
          changeDue,
          paymentMethod: dto.paymentMethod,
          items: { create: itemsData },
        },
        include: { items: { include: { product: true } }, customer: true },
      });

      if (grantedBy) {
        await tx.priceOverrideGrant.create({ data: { saleId: sale.id, grantedBy } });
      }

      for (const item of itemsData) {
        await tx.product.update({ where: { id: item.productId }, data: { quantity: { decrement: item.quantity } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.quantity,
            reason: `بيع #${sale.invoiceNumber}`,
          },
        });
      }

      if (dto.paymentMethod === 'CREDIT' && dto.customerId) {
        await tx.customer.update({ where: { id: dto.customerId }, data: { balance: { increment: total } } });
      }

      await this.audit.log(sellerId, 'SALE', 'Sale', sale.id, `فاتورة ${sale.invoiceNumber} بقيمة ${total}`, tx);

      return sale;
    });
  }

  findAll(from?: Date, to?: Date) {
    return this.prisma.sale.findMany({
      where: from || to ? { createdAt: { gte: from, lte: to } } : undefined,
      include: { items: true, customer: true, seller: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        seller: { select: { id: true, name: true } },
      },
    });
    if (!sale) throw new NotFoundException('الفاتورة غير موجودة');
    return sale;
  }

  // تعديل محدود: يعيد حساب الضريبة/الإجمالي/الباقي فقط، ولا يلمس المنتجات أو المخزون
  async update(id: string, dto: UpdateSaleDto) {
    const sale = await this.findOne(id);

    const discount = dto.discount ?? Number(sale.discount);
    const taxRate = dto.taxRate ?? Number(sale.taxRate);
    const amountPaid = dto.amountPaid ?? Number(sale.amountPaid);
    const paymentMethod = dto.paymentMethod ?? sale.paymentMethod;
    const invoiceType = dto.invoiceType ?? sale.invoiceType;

    if (paymentMethod === 'CREDIT' && !sale.customerId) {
      throw new BadRequestException('لا يمكن جعل الفاتورة على الحساب بدون زبون مرتبط بها');
    }

    const subtotal = Number(sale.subtotal);
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = taxable * (taxRate / 100);
    const total = taxable + taxAmount;
    const changeDue = Math.max(0, amountPaid - total);

    const oldCreditAmount = sale.paymentMethod === 'CREDIT' && sale.customerId ? Number(sale.total) : 0;
    const newCreditAmount = paymentMethod === 'CREDIT' && sale.customerId ? total : 0;
    const balanceDelta = newCreditAmount - oldCreditAmount;

    return this.prisma.$transaction(async (tx) => {
      if (sale.customerId && balanceDelta !== 0) {
        await tx.customer.update({ where: { id: sale.customerId }, data: { balance: { increment: balanceDelta } } });
      }

      return tx.sale.update({
        where: { id },
        data: { invoiceType, paymentMethod, discount, taxRate, taxAmount, total, amountPaid, changeDue },
        include: { items: { include: { product: true } }, customer: true, seller: { select: { id: true, name: true } } },
      });
    });
  }

  // يعكس المخزون ورصيد الزبون ثم يحذف الفاتورة (السطور وتفويضات السعر تُحذف تلقائياً بالتتالي)
  async remove(id: string) {
    const sale = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        await tx.product.update({ where: { id: item.productId }, data: { quantity: { increment: item.quantity } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'ADJUSTMENT',
            quantity: item.quantity,
            reason: `حذف فاتورة #${sale.invoiceNumber}`,
          },
        });
      }

      if (sale.paymentMethod === 'CREDIT' && sale.customerId) {
        await tx.customer.update({ where: { id: sale.customerId }, data: { balance: { decrement: Number(sale.total) } } });
      }

      await tx.sale.delete({ where: { id } });
      return { ok: true };
    });
  }

  async generateInvoicePdf(id: string, locale: 'ar' | 'fr' = 'ar'): Promise<Buffer> {
    // استيراد ديناميكي: يتجنب تحميل Puppeteer (وأخطاء تحويل ESM في Jest) عند تحميل هذه الخدمة من أجل اختبارات لا تستدعي هذه الدالة
    const { buildInvoiceHtml, renderPdfFromHtml, invoiceWalkInCustomerLabel } = await import('../reports/pdf.util');
    const sale = await this.findOne(id);
    const store = await this.prisma.storeSettings.findFirst();

    const html = buildInvoiceHtml({
      invoiceNumber: sale.invoiceNumber,
      createdAt: sale.createdAt,
      customerName: sale.customer?.name ?? invoiceWalkInCustomerLabel(locale),
      locale,
      items: sale.items.map((item) => ({
        name: item.product?.name ?? item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      taxRate: Number(sale.taxRate),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      amountPaid: Number(sale.amountPaid),
      changeDue: Number(sale.changeDue),
      store: {
        name: store?.name ?? '',
        address: store?.address,
        phone: store?.phone,
        ifNumber: store?.ifNumber,
        ice: store?.ice,
        rc: store?.rc,
        patente: store?.patente,
      },
    });

    return renderPdfFromHtml(html);
  }

  private verifyOverrideToken(token?: string): string {
    if (!token) throw new UnauthorizedException('يتطلب تعديل السعر تفويضاً من المدير');
    try {
      const payload = this.jwt.verify(token) as { sub: string; role: string; type: string };
      if (payload.type !== 'override' || payload.role !== 'ADMIN') throw new Error();
      return payload.sub;
    } catch {
      throw new UnauthorizedException('تفويض المدير غير صالح أو منتهي الصلاحية');
    }
  }

  private async nextInvoiceNumber(tx: Prisma.TransactionClient) {
    const today = new Date();
    const prefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
      today.getDate(),
    ).padStart(2, '0')}`;
    const countToday = await tx.sale.count({ where: { invoiceNumber: { startsWith: prefix } } });
    return `${prefix}-${String(countToday + 1).padStart(4, '0')}`;
  }
}
