'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileText, Package, Receipt, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardSummary } from '@/lib/dashboard';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import type { DashboardSummary } from '@/types';

const STAT_CARDS: {
  key: keyof Pick<
    DashboardSummary,
    'todayTransactionsCount' | 'profitToday' | 'totalInvoices' | 'totalProducts' | 'lowStockCount'
  >;
  label: string;
  icon: typeof Receipt;
  format: (value: number) => string;
  warnIfPositive?: boolean;
}[] = [
  { key: 'todayTransactionsCount', label: 'معاملات اليوم', icon: Receipt, format: (v) => v.toLocaleString('ar-MA') },
  { key: 'profitToday', label: 'أرباح اليوم', icon: Wallet, format: formatCurrency },
  { key: 'totalInvoices', label: 'عدد الفواتير', icon: FileText, format: (v) => v.toLocaleString('ar-MA') },
  { key: 'totalProducts', label: 'عدد المنتجات', icon: Package, format: (v) => v.toLocaleString('ar-MA') },
  {
    key: 'lowStockCount',
    label: 'منتجات قليلة المخزون',
    icon: AlertTriangle,
    format: (v) => v.toLocaleString('ar-MA'),
    warnIfPositive: true,
  },
];

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-muted-foreground">نظرة سريعة على نشاط المحل اليوم</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map(({ key, label, icon: Icon, format, warnIfPositive }) => {
          const value = data?.[key];
          const warn = warnIfPositive && typeof value === 'number' && value > 0;
          return (
            <Card key={key}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  {isLoading || value === undefined ? (
                    <Skeleton className="mt-2 h-7 w-16" />
                  ) : (
                    <p className={cn('mt-1 text-xl font-bold', warn && 'text-destructive')}>{format(value)}</p>
                  )}
                </div>
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
                    warn && 'bg-destructive/10 text-destructive',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isError && <p className="text-sm text-destructive">تعذّر تحميل بيانات لوحة التحكم.</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">منتجات قليلة المخزون</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            {!isLoading && data?.lowStockProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد منتجات قليلة المخزون حالياً.</p>
            )}
            {data?.lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm">{p.name}</span>
                <Badge variant="destructive">
                  {p.quantity} / {p.minStock}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">آخر المبيعات</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mb-2 h-10 w-full" />)}
            {!isLoading && data?.recentSales.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد مبيعات بعد.</p>
            )}
            {data && data.recentSales.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-muted-foreground">
                    <th className="py-2 font-medium">الفاتورة</th>
                    <th className="py-2 font-medium">الزبون</th>
                    <th className="py-2 font-medium">المجموع</th>
                    <th className="py-2 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                    >
                      <td className="py-2">
                        <Link href={`/sales/${sale.id}`} className="text-primary hover:underline">
                          {sale.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-2">{sale.customerName ?? 'زبون عابر'}</td>
                      <td className="py-2">{formatCurrency(sale.total)}</td>
                      <td className="py-2 text-muted-foreground">{formatDateTime(sale.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
