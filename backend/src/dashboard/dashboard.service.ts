import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todaySales, totalInvoices, totalProducts, activeProducts, recentSales] = await Promise.all([
      this.prisma.sale.findMany({
        where: { createdAt: { gte: startOfDay } },
        include: { items: { include: { product: { select: { purchasePrice: true } } } } },
      }),
      this.prisma.sale.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.findMany({ where: { isActive: true } }),
      this.prisma.sale.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } }, seller: { select: { name: true } } },
      }),
    ]);

    let revenueToday = 0;
    let costToday = 0;
    for (const sale of todaySales) {
      revenueToday += Number(sale.subtotal) - Number(sale.discount);
      for (const item of sale.items) {
        costToday += item.quantity * Number(item.product.purchasePrice);
      }
    }

    const lowStockProducts = activeProducts.filter((p) => p.quantity <= p.minStock);

    return {
      todayTransactionsCount: todaySales.length,
      profitToday: revenueToday - costToday,
      totalInvoices,
      totalProducts,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.slice(0, 10).map((p) => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        minStock: p.minStock,
      })),
      recentSales: recentSales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        total: s.total,
        customerName: s.customer?.name ?? null,
        sellerName: s.seller.name,
        createdAt: s.createdAt,
      })),
    };
  }
}
