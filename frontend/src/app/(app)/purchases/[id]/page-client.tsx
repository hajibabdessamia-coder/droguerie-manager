'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPurchase } from '@/lib/purchases';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useRouteId } from '@/lib/use-route-id';
import { useLocale } from '@/i18n/locale-provider';

export default function PurchaseDetailPage() {
  const id = useRouteId();
  const { t, locale } = useLocale();

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => fetchPurchase(id),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!purchase) return <p className="text-sm text-destructive">{t('purchases.notFound')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {t('purchases.detailTitlePrefix')}
            {purchase.supplier.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {purchase.invoiceRef ? `${t('purchases.refLabel')}: ${purchase.invoiceRef} · ` : ''}
            {formatDateTime(purchase.date, locale)}
          </p>
        </div>
        <Link href="/purchases" className={buttonVariants({ variant: 'outline' })}>
          {t('purchases.backToAll')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">{t('common.productsSectionTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-muted-foreground">
                <th className="py-2 font-medium">{t('common.product')}</th>
                <th className="py-2 font-medium">{t('common.quantity')}</th>
                <th className="py-2 font-medium">{t('common.purchasePrice')}</th>
                <th className="py-2 font-medium">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-2">{item.product?.name ?? item.productId}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2">{formatCurrency(item.purchasePrice, locale)}</td>
                  <td className="py-2">{formatCurrency(item.total, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end border-t border-border pt-3 text-base font-bold">
            <span>
              {t('common.grandTotal')}: {formatCurrency(purchase.total, locale)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
