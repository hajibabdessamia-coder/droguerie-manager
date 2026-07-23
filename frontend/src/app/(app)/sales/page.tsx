'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSales } from '@/lib/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function SalesPage() {
  const { data: sales, isLoading } = useQuery({ queryKey: ['sales'], queryFn: fetchSales });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">الفواتير المحفوظة</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sales ? `${sales.length} فاتورة بيع` : '...'}</p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-right text-muted-foreground">
                <th className="px-4 py-3 font-medium">الفاتورة</th>
                <th className="px-4 py-3 font-medium">الزبون</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
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
              {!isLoading && sales?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    لا توجد فواتير بيع بعد.
                  </td>
                </tr>
              )}
              {sales?.map((sale) => (
                <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link href={`/sales/${sale.id}`} className="font-medium text-primary hover:underline">
                      {sale.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{sale.customer?.name ?? 'زبون عابر'}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(sale.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(sale.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
