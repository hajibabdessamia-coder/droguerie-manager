'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSales } from '@/lib/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useLocale } from '@/i18n/locale-provider';

export default function SalesPage() {
  const { t, locale } = useLocale();
  const { data: sales, isLoading, isError } = useQuery({ queryKey: ['sales'], queryFn: fetchSales });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.sales')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sales ? `${sales.length} ${t('sales.countSuffix')}` : '...'}
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-start text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('common.invoiceColumn')}</th>
                <th className="px-4 py-3 font-medium">{t('common.customerLabel')}</th>
                <th className="px-4 py-3 font-medium">{t('common.grandTotal')}</th>
                <th className="px-4 py-3 font-medium">{t('common.date')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-destructive">
                    {t('sales.loadError')}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && sales?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    {t('sales.emptyState')}
                  </td>
                </tr>
              )}
              {!isError && sales?.map((sale) => (
                <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link href={`/sales/${sale.id}`} className="font-medium text-primary hover:underline">
                      {sale.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{sale.customer?.name ?? t('common.walkInCustomer')}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(sale.total, locale)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(sale.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
