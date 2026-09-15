'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileText, Package, Receipt, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardSummary } from '@/lib/dashboard';
import { cn, formatCurrency, formatDateTime, formatNumber } from '@/lib/utils';
import { useLocale } from '@/i18n/locale-provider';
import type { Locale, TranslationKey } from '@/i18n/types';
import type { DashboardSummary } from '@/types';

interface StatCard {
  key: keyof Pick<
    DashboardSummary,
    'todayTransactionsCount' | 'profitToday' | 'totalInvoices' | 'totalProducts' | 'lowStockCount'
  >;
  labelKey: TranslationKey;
  icon: typeof Receipt;
  format: (value: number) => string;
  warnIfPositive?: boolean;
}

// تُبنى هنا (وليس كثابت خارج المكوّن كما كانت سابقاً) لأنها تحتاج اللغة الحالية عبر
// useLocale()، وهي متاحة فقط داخل المكوّن — التكلفة زهيدة (5 عناصر) فلا داعي لـ useMemo
function buildStatCards(locale: Locale): StatCard[] {
  const count = (v: number) => formatNumber(v, locale);
  return [
    { key: 'todayTransactionsCount', labelKey: 'dashboard.stats.todayTransactions', icon: Receipt, format: count },
    { key: 'profitToday', labelKey: 'dashboard.stats.profitToday', icon: Wallet, format: (v) => formatCurrency(v, locale) },
    { key: 'totalInvoices', labelKey: 'dashboard.stats.totalInvoices', icon: FileText, format: count },
    { key: 'totalProducts', labelKey: 'dashboard.stats.totalProducts', icon: Package, format: count },
    {
      key: 'lowStockCount',
      labelKey: 'dashboard.stats.lowStockCount',
      icon: AlertTriangle,
      format: count,
      warnIfPositive: true,
    },
  ];
}

export default function DashboardPage() {
  const { t, locale } = useLocale();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60_000,
  });
  const statCards = buildStatCards(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map(({ key, labelKey, icon: Icon, format, warnIfPositive }) => {
          const value = data?.[key];
          const warn = warnIfPositive && typeof value === 'number' && value > 0;
          return (
            <Card key={key}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{t(labelKey)}</p>
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

      {isError && <p className="text-sm text-destructive">{t('dashboard.loadError')}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('dashboard.lowStock.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            {!isLoading && data?.lowStockProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('dashboard.lowStock.empty')}</p>
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
            <CardTitle className="text-base font-semibold text-foreground">{t('dashboard.recentSales.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mb-2 h-10 w-full" />)}
            {!isLoading && data?.recentSales.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('dashboard.recentSales.empty')}</p>
            )}
            {data && data.recentSales.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  {/* text-start (وليس text-right) لتبقى محاذاة العناوين صحيحة تلقائياً
                      في الاتجاهين: يمين في RTL (كما هو الحال حالياً)، يسار في LTR */}
                  <tr className="border-b border-border text-start text-muted-foreground">
                    <th className="py-2 font-medium">{t('dashboard.recentSales.columns.invoice')}</th>
                    <th className="py-2 font-medium">{t('dashboard.recentSales.columns.customer')}</th>
                    <th className="py-2 font-medium">{t('dashboard.recentSales.columns.total')}</th>
                    <th className="py-2 font-medium">{t('dashboard.recentSales.columns.date')}</th>
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
                      {/* sale.customerName بيانات زبون حقيقية عند وجودها — لا تُترجَم؛
                          البديل الاحتياطي فقط (لا يوجد زبون مرتبط بالفاتورة) يُترجَم */}
                      <td className="py-2">{sale.customerName ?? t('dashboard.recentSales.walkInCustomer')}</td>
                      <td className="py-2">{formatCurrency(sale.total, locale)}</td>
                      <td className="py-2 text-muted-foreground">{formatDateTime(sale.createdAt, locale)}</td>
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
