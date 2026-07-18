'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { addCustomerPayment, deleteCustomer, fetchCustomer } from '@/lib/customers';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

const TYPE_LABEL: Record<string, string> = { WHOLESALE: 'جملة', RETAIL: 'تقسيط' };

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomer(id),
  });

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const paymentMutation = useMutation({
    mutationFn: () => addCustomerPayment(id, Number(amount), note || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setAmount('');
      setNote('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCustomer(id),
    onSuccess: () => router.push('/customers'),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!customer) return <p className="text-sm text-destructive">الزبون غير موجود.</p>;

  const balance = Number(customer.balance);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {TYPE_LABEL[customer.type]} · {customer.phone ?? 'بدون هاتف'} · {customer.address ?? 'بدون عنوان'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/customers/${id}/edit`} className="inline-flex">
            <Button type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              تعديل
            </Button>
          </Link>
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (window.confirm(`هل تريد حذف الزبون "${customer.name}"؟`)) deleteMutation.mutate();
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
              حذف
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
            <p className={cn('mt-1 text-2xl font-bold', balance > 0 && 'text-destructive')}>
              {formatCurrency(customer.balance)}
            </p>
          </div>
          {balance > 0 && <Badge variant="destructive">مدين للمحل</Badge>}
          {balance < 0 && <Badge variant="secondary">له رصيد زائد</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">تسجيل دفعة</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="amount" className="text-sm font-medium">
              المبلغ
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
              ملاحظة (اختياري)
            </label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} className="w-56" />
          </div>
          <Button
            type="button"
            disabled={!amount || paymentMutation.isPending}
            onClick={() => paymentMutation.mutate()}
          >
            تسجيل الدفعة
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">آخر المشتريات</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {customer.sales.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مشتريات بعد.</p>}
            {customer.sales.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-muted-foreground">
                    <th className="py-2 font-medium">الفاتورة</th>
                    <th className="py-2 font-medium">المجموع</th>
                    <th className="py-2 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.sales.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2">{s.invoiceNumber}</td>
                      <td className="py-2">{formatCurrency(s.total)}</td>
                      <td className="py-2 text-muted-foreground">{formatDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">سجل الدفعات</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {customer.payments.length === 0 && <p className="text-sm text-muted-foreground">لا توجد دفعات بعد.</p>}
            {customer.payments.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-muted-foreground">
                    <th className="py-2 font-medium">المبلغ</th>
                    <th className="py-2 font-medium">ملاحظة</th>
                    <th className="py-2 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2">{formatCurrency(p.amount)}</td>
                      <td className="py-2 text-muted-foreground">{p.note ?? '—'}</td>
                      <td className="py-2 text-muted-foreground">{formatDateTime(p.createdAt)}</td>
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
