import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportPeriod } from './dto/report-query.dto';
import { buildExcelBuffer } from './excel.util';
import { getPeriodRange, getPeriodLabel } from './period.util';
import { buildSummaryReportHtml, invoiceWalkInCustomerLabel, renderPdfFromHtml, type InvoiceLocale } from './pdf.util';
import { REPORT_LABELS } from './report-labels';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(period: ReportPeriod, dateStr?: string, locale: InvoiceLocale = 'ar') {
    const { start, end } = getPeriodRange(period, dateStr);

    const [sales, saleReturns, purchasesAgg, activeProducts] = await Promise.all([
      this.prisma.sale.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: { items: { include: { product: { select: { id: true, name: true, purchasePrice: true } } } } },
      }),
      // الإرجاعات تُحسب بتاريخ حدوثها (createdAt الخاص بها)، وليس بتاريخ الفاتورة
      // الأصلية — إرجاع يحدث في فترة تقرير لاحقة يُخفّض صافي مبيعات تلك الفترة هي،
      // حتى لو كانت الفاتورة الأصلية ضمن فترة سابقة لم تعد ضمن نطاق هذا الاستعلام
      this.prisma.saleReturn.findMany({
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

    let returnsTotal = 0;
    let returnsRevenue = 0;
    let returnsCost = 0;

    for (const ret of saleReturns) {
      returnsTotal += Number(ret.total);
      returnsRevenue += Number(ret.subtotal) - Number(ret.discountShare);
      for (const item of ret.items) {
        returnsCost += item.quantity * Number(item.product.purchasePrice);
        const entry = soldByProduct.get(item.productId) ?? { name: item.product.name, qty: 0, revenue: 0 };
        entry.qty -= item.quantity;
        entry.revenue -= Number(item.total);
        soldByProduct.set(item.productId, entry);
      }
    }

    const topProducts = [...soldByProduct.values()]
      .filter((p) => p.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const allProductStats = activeProducts.map((p) => {
      const sold = soldByProduct.get(p.id);
      return { name: p.name, qty: sold?.qty ?? 0, revenue: sold?.revenue ?? 0 };
    });
    const leastProducts = allProductStats.sort((a, b) => a.qty - b.qty).slice(0, 5);

    const inventoryValue = activeProducts.reduce((sum, p) => sum + p.quantity * Number(p.purchasePrice), 0);

    return {
      period,
      periodLabel: getPeriodLabel(period, locale),
      start,
      end,
      // صافي بعد خصم الإرجاعات — وليس إجمالي الفواتير المُصدَرة
      salesTotal: salesTotal - returnsTotal,
      returnsTotal,
      profitTotal: revenueTotal - returnsRevenue - (costTotal - returnsCost),
      invoiceCount: sales.length,
      purchasesValue: Number(purchasesAgg._sum.total ?? 0),
      inventoryValue,
      topProducts,
      leastProducts,
    };
  }

  async exportSummaryPdf(period: ReportPeriod, dateStr?: string, locale: InvoiceLocale = 'ar'): Promise<Buffer> {
    const report = await this.getSummary(period, dateStr, locale);
    const html = buildSummaryReportHtml(report, locale);
    return renderPdfFromHtml(html);
  }

  async exportSalesExcel(from?: Date, to?: Date, locale: InvoiceLocale = 'ar'): Promise<Buffer> {
    const l = REPORT_LABELS[locale];
    const dateLocale = locale === 'ar' ? 'ar-MA' : 'fr-FR';
    const sales = await this.prisma.sale.findMany({
      where: from || to ? { createdAt: { gte: from, lte: to } } : undefined,
      include: {
        customer: { select: { name: true } },
        seller: { select: { name: true } },
        items: { include: { product: { select: { purchasePrice: true } } } },
        returns: { include: { items: { include: { product: { select: { purchasePrice: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = sales.map((sale) => {
      const cost = sale.items.reduce((sum, item) => sum + item.quantity * Number(item.product.purchasePrice), 0);
      const profit = Number(sale.subtotal) - Number(sale.discount) - cost;

      const returned = sale.returns.reduce((sum, ret) => sum + Number(ret.total), 0);
      const returnedRevenue = sale.returns.reduce((sum, ret) => sum + Number(ret.subtotal) - Number(ret.discountShare), 0);
      const returnedCost = sale.returns.reduce(
        (sum, ret) => sum + ret.items.reduce((s, item) => s + item.quantity * Number(item.product.purchasePrice), 0),
        0,
      );

      return {
        invoiceNumber: sale.invoiceNumber,
        date: sale.createdAt.toLocaleString(dateLocale),
        customer: sale.customer?.name ?? invoiceWalkInCustomerLabel(locale),
        seller: sale.seller.name,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.taxAmount),
        total: Number(sale.total),
        returned,
        netTotal: Number(sale.total) - returned,
        profit: profit - (returnedRevenue - returnedCost),
        paymentMethod: l.paymentMethod[sale.paymentMethod as 'CASH' | 'CREDIT'],
      };
    });

    return buildExcelBuffer(
      l.sales.sheetTitle,
      [
        { header: l.sales.invoiceNumber, key: 'invoiceNumber', width: 20 },
        { header: l.sales.date, key: 'date', width: 20 },
        { header: l.sales.customer, key: 'customer', width: 20 },
        { header: l.sales.seller, key: 'seller', width: 18 },
        { header: l.sales.subtotal, key: 'subtotal', width: 15 },
        { header: l.sales.discount, key: 'discount', width: 12 },
        { header: l.sales.tax, key: 'tax', width: 12 },
        { header: l.sales.total, key: 'total', width: 15 },
        { header: l.sales.returned, key: 'returned', width: 15 },
        { header: l.sales.netTotal, key: 'netTotal', width: 15 },
        { header: l.sales.profit, key: 'profit', width: 15 },
        { header: l.sales.paymentMethod, key: 'paymentMethod', width: 15 },
      ],
      rows,
      locale,
    );
  }

  async exportProductsExcel(locale: InvoiceLocale = 'ar'): Promise<Buffer> {
    const l = REPORT_LABELS[locale];
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
      l.products.sheetTitle,
      [
        { header: l.products.name, key: 'name', width: 25 },
        { header: l.products.internalCode, key: 'internalCode', width: 15 },
        { header: l.products.manufacturer, key: 'manufacturer', width: 18 },
        { header: l.products.purchasePrice, key: 'purchasePrice', width: 12 },
        { header: l.products.retailPrice, key: 'retailPrice', width: 12 },
        { header: l.products.wholesalePrice, key: 'wholesalePrice', width: 12 },
        { header: l.products.quantity, key: 'quantity', width: 10 },
        { header: l.products.minStock, key: 'minStock', width: 12 },
        { header: l.products.inventoryValue, key: 'inventoryValue', width: 15 },
      ],
      rows,
      locale,
    );
  }

  async exportCustomersExcel(locale: InvoiceLocale = 'ar'): Promise<Buffer> {
    const l = REPORT_LABELS[locale];
    const customers = await this.prisma.customer.findMany({ orderBy: { name: 'asc' } });
    const rows = customers.map((c) => ({
      name: c.name,
      phone: c.phone ?? '',
      address: c.address ?? '',
      type: l.customerType[c.type as 'WHOLESALE' | 'RETAIL'],
      balance: Number(c.balance),
    }));

    return buildExcelBuffer(
      l.customers.sheetTitle,
      [
        { header: l.customers.name, key: 'name', width: 22 },
        { header: l.customers.phone, key: 'phone', width: 16 },
        { header: l.customers.address, key: 'address', width: 25 },
        { header: l.customers.type, key: 'type', width: 12 },
        { header: l.customers.balance, key: 'balance', width: 14 },
      ],
      rows,
      locale,
    );
  }

  async exportSuppliersExcel(locale: InvoiceLocale = 'ar'): Promise<Buffer> {
    const l = REPORT_LABELS[locale];
    const suppliers = await this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    const rows = suppliers.map((s) => ({
      name: s.name,
      phone: s.phone ?? '',
      address: s.address ?? '',
      balance: Number(s.balance),
    }));

    return buildExcelBuffer(
      l.suppliers.sheetTitle,
      [
        { header: l.suppliers.name, key: 'name', width: 22 },
        { header: l.suppliers.phone, key: 'phone', width: 16 },
        { header: l.suppliers.address, key: 'address', width: 25 },
        { header: l.suppliers.balance, key: 'balance', width: 14 },
      ],
      rows,
      locale,
    );
  }
}
