'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Download, Pencil, Printer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteSale, downloadSaleInvoicePdf, fetchSale, updateSale } from '@/lib/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useRouteId } from '@/lib/use-route-id';
import { useAuthStore } from '@/store/auth-store';
import { useLocale } from '@/i18n/locale-provider';
import type { InvoiceType, PaymentMethod } from '@/types';

export default function SaleDetailPage() {
  const id = useRouteId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { t, locale } = useLocale();

  const { data: sale, isLoading } = useQuery({ queryKey: ['sale', id], queryFn: () => fetchSale(id) });

  const [editing, setEditing] = useState(false);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('TICKET');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startEditing() {
    if (!sale) return;
    setInvoiceType(sale.invoiceType);
    setPaymentMethod(sale.paymentMethod);
    setDiscount(sale.discount);
    setTaxRate(sale.taxRate);
    setAmountPaid(sale.amountPaid);
    setError(null);
    setEditing(true);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateSale(id, {
        invoiceType,
        paymentMethod,
        discount: Number(discount),
        taxRate: Number(taxRate),
        amountPaid: Number(amountPaid),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sale', id] });
      setEditing(false);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message ?? t('sales.genericUpdateError'));
    },
  });

  const pdfMutation = useMutation({
    mutationFn: () => downloadSaleInvoicePdf(id, sale!.invoiceNumber),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSale(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      router.push('/dashboard');
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setDeleteError(message ?? t('sales.deleteError'));
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!sale) return <p className="text-sm text-destructive">{t('sales.notFound')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">
            {t('sales.titlePrefix')}
            {sale.invoiceNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(sale.createdAt, locale)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {t('sales.reprintButton')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => pdfMutation.mutate()}
            disabled={pdfMutation.isPending}
          >
            <Download className="h-4 w-4" />
            {t('sales.downloadPdfButton')}
          </Button>
          {isAdmin && !editing && (
            <Button type="button" variant="outline" onClick={startEditing}>
              <Pencil className="h-4 w-4" />
              {t('common.edit')}
            </Button>
          )}
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (
                  window.confirm(
                    `${t('sales.deleteConfirmPrefix')} "${sale.invoiceNumber}"${t('sales.deleteConfirmSuffix')}`,
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
              {t('common.delete')}
            </Button>
          )}
        </div>
      </div>

      {deleteError && <p className="text-sm text-destructive print:hidden">{deleteError}</p>}
      {pdfMutation.isError && (
        <p className="text-sm text-destructive print:hidden">{t('sales.downloadPdfError')}</p>
      )}

      {editing && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('sales.editCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoiceType">{t('sales.invoiceTypeLabel')}</Label>
              <Select id="invoiceType" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}>
                <option value="TICKET">{t('sales.invoiceType.TICKET')}</option>
                <option value="LEGAL">{t('sales.invoiceType.LEGAL')}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentMethod">{t('sales.paymentMethodLabel')}</Label>
              <Select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="CASH">{t('sales.paymentMethod.CASH')}</option>
                <option value="CREDIT">{t('sales.paymentMethod.CREDIT')}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discount">{t('sales.discountLabel')}</Label>
              <Input id="discount" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taxRate">{t('sales.taxRateFormLabel')}</Label>
              <Input id="taxRate" type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amountPaid">{t('sales.amountPaidFormLabel')}</Label>
              <Input id="amountPaid" type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}

            <div className="flex gap-3 md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                {updateMutation.isPending ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            {sale.customer?.name ?? t('common.walkInCustomer')}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-muted-foreground">
                <th className="py-2 font-medium">{t('common.product')}</th>
                <th className="py-2 font-medium">{t('common.quantity')}</th>
                <th className="py-2 font-medium">{t('sales.unitPriceColumn')}</th>
                <th className="py-2 font-medium">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-2">{item.product?.name ?? item.productId}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2">{formatCurrency(item.unitPrice, locale)}</td>
                  <td className="py-2">{formatCurrency(item.total, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-sm md:ms-auto md:w-64">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('sales.subtotalLabel')}</span>
              <span>{formatCurrency(sale.subtotal, locale)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t('sales.discountLabel')}</span>
              <span>{formatCurrency(sale.discount, locale)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t('sales.taxLabel')} ({Number(sale.taxRate)}%)
              </span>
              <span>{formatCurrency(sale.taxAmount, locale)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>{t('common.grandTotal')}</span>
              <span>{formatCurrency(sale.total, locale)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t('sales.paidLabel')}</span>
              <span>{formatCurrency(sale.amountPaid, locale)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t('sales.changeDueLabel')}</span>
              <span>{formatCurrency(sale.changeDue, locale)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
