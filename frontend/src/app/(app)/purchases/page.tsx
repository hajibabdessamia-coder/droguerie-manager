'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPurchases } from '@/lib/purchases';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

export default function PurchasesPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const { data: purchases, isLoading } = useQuery({ queryKey: ['purchases'], queryFn: fetchPurchases });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المشتريات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{purchases ? `${purchases.length} فاتورة شراء` : '...'}</p>
        </div>
        {isAdmin && (
          <Link href="/purchases/new" className={buttonVariants({ size: 'default' })}>
            <Plus className="h-4 w-4" />
            فاتورة شراء جديدة
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-right text-muted-foreground">
                <th className="px-4 py-3 font-medium">المورد</th>
                <th className="px-4 py-3 font-medium">مرجع الفاتورة</th>
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
              {!isLoading && purchases?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    لا توجد فواتير شراء بعد.
                  </td>
                </tr>
              )}
              {purchases?.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link href={`/purchases/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.supplier.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.invoiceRef ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(p.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(p.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
