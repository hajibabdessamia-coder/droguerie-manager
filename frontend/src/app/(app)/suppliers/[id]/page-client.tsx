'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { addSupplierPayment, deleteSupplier, fetchSupplier } from '@/lib/suppliers';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import { useRouteId } from '@/lib/use-route-id';
import { useAuthStore } from '@/store/auth-store';
import { useLocale } from '@/i18n/locale-provider';

export default function SupplierDetailPage() {
  const id = useRouteId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { t, locale } = useLocale();

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => fetchSupplier(id),
  });

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const paymentMutation = useMutation({
    mutationFn: () => addSupplierPayment(id, Number(amount), note || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setAmount('');
      setNote('');
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setPaymentError(message ?? t('suppliers.paymentError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSupplier(id),
    onSuccess: () => router.push('/suppliers'),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!supplier) return <p className="text-sm text-destructive">{t('suppliers.notFound')}</p>;

  const balance = Number(supplier.balance);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{supplier.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {supplier.phone ?? t('common.noPhone')} · {supplier.address ?? t('common.noAddress')}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link href={`/suppliers/${id}/edit`} className="inline-flex">
              <Button type="button" variant="outline">
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (window.confirm(`${t('suppliers.deleteConfirmPrefix')} "${supplier.name}"${t('common.deleteConfirmSuffix')}`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
              {t('common.delete')}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm text-muted-foreground">{t('suppliers.currentBalanceLabel')}</p>
            <p className={cn('mt-1 text-2xl font-bold', balance > 0 && 'text-destructive')}>
              {formatCurrency(supplier.balance, locale)}
            </p>
          </div>
          {balance > 0 && <Badge variant="destructive">{t('suppliers.dueBadge')}</Badge>}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('suppliers.recordPaymentTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="amount" className="text-sm font-medium">
                {t('common.amount')}
              </label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="note" className="text-sm font-medium">
                {t('common.noteOptional')}
              </label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} className="w-56" />
            </div>
            <Button
              type="button"
              disabled={!amount || paymentMutation.isPending}
              onClick={() => {
                setPaymentError(null);
                paymentMutation.mutate();
              }}
            >
              {t('common.recordPaymentButton')}
            </Button>
            {paymentError && <p className="w-full text-sm text-destructive">{paymentError}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              {t('suppliers.recentPurchaseInvoicesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {supplier.purchases.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('common.noPurchaseInvoicesYet')}</p>
            )}
            {supplier.purchases.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-muted-foreground">
                    <th className="py-2 font-medium">{t('common.supplierInvoiceRefColumn')}</th>
                    <th className="py-2 font-medium">{t('common.total')}</th>
                    <th className="py-2 font-medium">{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.purchases.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2">{p.invoiceRef ?? '—'}</td>
                      <td className="py-2">{formatCurrency(p.total, locale)}</td>
                      <td className="py-2 text-muted-foreground">{formatDateTime(p.date, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('common.paymentsHistoryTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {supplier.payments.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('common.noPaymentsYet')}</p>
            )}
            {supplier.payments.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-muted-foreground">
                    <th className="py-2 font-medium">{t('common.amount')}</th>
                    <th className="py-2 font-medium">{t('common.note')}</th>
                    <th className="py-2 font-medium">{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2">{formatCurrency(p.amount, locale)}</td>
                      <td className="py-2 text-muted-foreground">{p.note ?? '—'}</td>
                      <td className="py-2 text-muted-foreground">{formatDateTime(p.createdAt, locale)}</td>
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
