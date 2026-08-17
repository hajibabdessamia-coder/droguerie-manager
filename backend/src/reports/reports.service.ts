import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportPeriod } from './dto/report-query.dto';
import { buildExcelBuffer } from './excel.util';
import { getPeriodRange, PERIOD_LABEL } from './period.util';
import { buildSummaryReportHtml, renderPdfFromHtml } from './pdf.util';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(period: ReportPeriod, dateStr?: string) {
    const { start, end } = getPeriodRange(period, dateStr);

    const [sales, purchasesAgg, activeProducts] = await Promise.all([
      this.prisma.sale.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: { items: { include: { product: { select: { id: true, name: true, purchasePrice: true } } } } },
      }),
      this.prisma.purchase.aggregate({
        where: { date: { gte: start, lt: end } },
        _sum: { total: true },
      }),
      this.prisma.product.findMany({ where: { isActive: true } }),
    ]);

    let salesTotal = 0;
    let revenueTotal = 0;
    let costTotal = 0;
    const soldByProduct = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const sale of sales) {
      salesTotal += Number(sale.total);
      revenueTotal += Number(sale.subtotal) - Number(sale.discount);
      for (const item of sale.items) {
        costTotal += item.quantity * Number(item.product.purchasePrice);
        const entry = soldByProduct.get(item.productId) ?? { name: item.product.name, qty: 0, revenue: 0 };
        entry.qty += item.quantity;
        entry.revenue += Number(item.total);
        soldByProduct.set(item.productId, entry);
      }
    }

    const topProducts = [...soldByProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    const allProductStats = activeProducts.map((p) => {
      const sold = soldByProduct.get(p.id);
      return { name: p.name, qty: sold?.qty ?? 0, revenue: sold?.revenue ?? 0 };
    });
    const leastProducts = allProductStats.sort((a, b) => a.qty - b.qty).slice(0, 5);

    const inventoryValue = activeProducts.reduce((sum, p) => sum + p.quantity * Number(p.purchasePrice), 0);

    return {
      period,
      periodLabel: PERIOD_LABEL[period],
      start,
      end,
      salesTotal,
      profitTotal: revenueTotal - costTotal,
      invoiceCount: sales.length,
      purchasesValue: Number(purchasesAgg._sum.total ?? 0),
      inventoryValue,
      topProducts,
      leastProducts,
    };
  }

  async exportSummaryPdf(period: ReportPeriod, dateStr?: string): Promise<Buffer> {
    const report = await this.getSummary(period, dateStr);
    const html = buildSummaryReportHtml(report);
    return renderPdfFromHtml(html);
  }

  async exportSalesExcel(from?: Date, to?: Date): Promise<Buffer> {
    const sales = await this.prisma.sale.findMany({
      where: from || to ? { createdAt: { gte: from, lte: to } } : undefined,
      include: {
        customer: { select: { name: true } },
        seller: { select: { name: true } },
        items: { include: { product: { select: { purchasePrice: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = sales.map((sale) => {
      const cost = sale.items.reduce((sum, item) => sum + item.quantity * Number(item.product.purchasePrice), 0);
      const profit = Number(sale.subtotal) - Number(sale.discount) - cost;
      return {
        invoiceNumber: sale.invoiceNumber,
        date: sale.createdAt.toLocaleString('ar-MA'),
        customer: sale.customer?.name ?? 'زبون عابر',
        seller: sale.seller.name,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.taxAmount),
        total: Number(sale.total),
        profit,
        paymentMethod: sale.paymentMethod === 'CASH' ? 'نقدي' : 'على الحساب',
      };
    });

    return buildExcelBuffer(
      'المبيعات',
      [
        { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 20 },
        { header: 'التاريخ', key: 'date', width: 20 },
        { header: 'الزبون', key: 'customer', width: 20 },
        { header: 'البائع', key: 'seller', width: 18 },
        { header: 'المجموع الفرعي', key: 'subtotal', width: 15 },
        { header: 'الخصم', key: 'discount', width: 12 },
        { header: 'الضريبة', key: 'tax', width: 12 },
        { header: 'الإجمالي', key: 'total', width: 15 },
        { header: 'الربح', key: 'profit', width: 15 },
        { header: 'طريقة الدفع', key: 'paymentMethod', width: 15 },
      ],
      rows,
    );
  }

  async exportProductsExcel(): Promise<Buffer> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { manufacturer: true },
      orderBy: { name: 'asc' },
    });

    const rows = products.map((p) => ({
      name: p.name,
      internalCode: p.internalCode,
      manufacturer: p.manufacturer?.name ?? '',
      purchasePrice: Number(p.purchasePrice),
      retailPrice: Number(p.retailPrice),
      wholesalePrice: Number(p.wholesalePrice),
      quantity: p.quantity,
      minStock: p.minStock,
      inventoryValue: p.quantity * Number(p.purchasePrice),
    }));

    return buildExcelBuffer(
      'المنتجات والمخزون',
      [
        { header: 'اسم المنتج', key: 'name', width: 25 },
        { header: 'الكود الداخلي', key: 'internalCode', width: 15 },
        { header: 'الشركة المصنعة', key: 'manufacturer', width: 18 },
        { header: 'سعر الشراء', key: 'purchasePrice', width: 12 },
        { header: 'سعر التقسيط', key: 'retailPrice', width: 12 },
        { header: 'سعر الجملة', key: 'wholesalePrice', width: 12 },
        { header: 'الكمية', key: 'quantity', width: 10 },
        { header: 'الحد الأدنى', key: 'minStock', width: 12 },
        { header: 'قيمة المخزون', key: 'inventoryValue', width: 15 },
      ],
      rows,
    );
  }

  async exportCustomersExcel(): Promise<Buffer> {
    const customers = await this.prisma.customer.findMany({ orderBy: { name: 'asc' } });
    const rows = customers.map((c) => ({
      name: c.name,
      phone: c.phone ?? '',
      address: c.address ?? '',
      type: c.type === 'WHOLESALE' ? 'جملة' : 'تقسيط',
      balance: Number(c.balance),
    }));

    return buildExcelBuffer(
      'الزبائن',
      [
        { header: 'الاسم', key: 'name', width: 22 },
        { header: 'الهاتف', key: 'phone', width: 16 },
        { header: 'العنوان', key: 'address', width: 25 },
        { header: 'النوع', key: 'type', width: 12 },
        { header: 'الرصيد', key: 'balance', width: 14 },
      ],
      rows,
    );
  }

  async exportSuppliersExcel(): Promise<Buffer> {
    const suppliers = await this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    const rows = suppliers.map((s) => ({
      name: s.name,
      phone: s.phone ?? '',
      address: s.address ?? '',
      balance: Number(s.balance),
    }));

    return buildExcelBuffer(
      'الموردون',
      [
        { header: 'الاسم', key: 'name', width: 22 },
        { header: 'الهاتف', key: 'phone', width: 16 },
        { header: 'العنوان', key: 'address', width: 25 },
        { header: 'الرصيد', key: 'balance', width: 14 },
      ],
      rows,
    );
  }
}
