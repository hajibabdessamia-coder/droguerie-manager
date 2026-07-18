'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPurchase } from '@/lib/purchases';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => fetchPurchase(id),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!purchase) return <p className="text-sm text-destructive">فاتورة الشراء غير موجودة.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">فاتورة شراء — {purchase.supplier.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {purchase.invoiceRef ? `مرجع: ${purchase.invoiceRef} · ` : ''}
            {formatDateTime(purchase.date)}
          </p>
        </div>
        <Link href="/purchases" className={buttonVariants({ variant: 'outline' })}>
          رجوع لكل الفواتير
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">المنتجات</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-muted-foreground">
                <th className="py-2 font-medium">المنتج</th>
                <th className="py-2 font-medium">الكمية</th>
                <th className="py-2 font-medium">سعر الشراء</th>
                <th className="py-2 font-medium">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-2">{item.product?.name ?? item.productId}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2">{formatCurrency(item.purchasePrice)}</td>
                  <td className="py-2">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end border-t border-border pt-3 text-base font-bold">
            <span>الإجمالي: {formatCurrency(purchase.total)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
