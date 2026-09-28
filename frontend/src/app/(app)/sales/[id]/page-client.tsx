'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Download, Pencil, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createSaleReturn, deleteSale, downloadSaleInvoicePdf, fetchSale, updateSale } from '@/lib/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useRouteId } from '@/lib/use-route-id';
import { useAuthStore } from '@/store/auth-store';
import { printPage } from '@/lib/print';
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

  const [returning, setReturning] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);

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
    mutationFn: () => downloadSaleInvoicePdf(id, sale!.invoiceNumber, locale),
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

  // الكمية المتبقية القابلة للإرجاع من هذا السطر = المباعة ناقص ما أُرجع منه سابقاً
  // عبر إرجاعات سابقة مرتبطة بنفس الفاتورة
  function remainingReturnable(saleItemId: string, soldQuantity: number): number {
    const alreadyReturned = (sale?.returns ?? [])
      .flatMap((r) => r.items)
      .filter((ri) => ri.saleItemId === saleItemId)
      .reduce((sum, ri) => sum + ri.quantity, 0);
    return soldQuantity - alreadyReturned;
  }

  function startReturning() {
    setReturnQuantities({});
    setReturnReason('');
    setReturnError(null);
    setReturning(true);
  }

  const returnMutation = useMutation({
    mutationFn: () =>
      createSaleReturn(id, {
        reason: returnReason || undefined,
        items: Object.entries(returnQuantities)
          .map(([saleItemId, qty]) => ({ saleItemId, quantity: Number(qty) || 0 }))
          .filter((entry) => entry.quantity > 0),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sale', id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setReturning(false);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setReturnError(message ?? t('sales.returnGenericError'));
    },
  });

  function submitReturn() {
    setReturnError(null);
    const hasSelection = Object.values(returnQuantities).some((qty) => (Number(qty) || 0) > 0);
    if (!hasSelection) return setReturnError(t('sales.returnEmptySelectionError'));
    returnMutation.mutate();
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!sale) return <p className="text-sm text-destructive">{t('sales.notFound')}</p>;

  // مجموع الكميات المباعة مقابل المُرجعة عبر كل عمليات الإرجاع المرتبطة بهذه
  // الفاتورة، لتحديد شارة "مرتجع جزئي"/"مرتجع بالكامل" ومبلغ الصافي بعد الإرجاع
  const totalSoldQty = sale.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalReturnedQty = sale.returns.flatMap((r) => r.items).reduce((sum, item) => sum + item.quantity, 0);
  const returnsTotalAmount = sale.returns.reduce((sum, r) => sum + Number(r.total), 0);
  const netAfterReturns = Number(sale.total) - returnsTotalAmount;
  const isFullyReturned = sale.returns.length > 0 && totalReturnedQty >= totalSoldQty;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">
              {t('sales.titlePrefix')}
              {sale.invoiceNumber}
            </h1>
            {sale.returns.length > 0 && (
              <Badge variant={isFullyReturned ? 'destructive' : 'secondary'}>
                {isFullyReturned ? t('sales.fullyReturnedBadge') : t('sales.partialReturnBadge')}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(sale.createdAt, locale)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => printPage('document')}>
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
          {isAdmin && !returning && (
            <Button type="button" variant="outline" onClick={startReturning}>
              <RotateCcw className="h-4 w-4" />
              {t('sales.returnButton')}
            </Button>
          )}
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              disabled={sale.returns.length > 0}
              title={sale.returns.length > 0 ? t('sales.deleteBlockedByReturns') : undefined}
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

      {returning && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('sales.returnCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-muted-foreground">
                  <th className="py-2 font-medium">{t('common.product')}</th>
                  <th className="py-2 font-medium">{t('sales.returnRemainingColumn')}</th>
                  <th className="py-2 font-medium">{t('sales.returnQuantityColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => {
                  const remaining = remainingReturnable(item.id, item.quantity);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-2">{item.product?.name ?? item.productId}</td>
                      <td className="py-2">{remaining}</td>
                      <td className="py-2">
                        <Input
                          type="number"
                          min="0"
                          max={remaining}
                          step="1"
                          className="h-8 w-24 text-xs"
                          disabled={remaining <= 0}
                          value={returnQuantities[item.id] ?? ''}
                          onChange={(e) =>
                            setReturnQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="returnReason">{t('sales.returnReasonLabel')}</Label>
              <Input id="returnReason" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
            </div>

            {returnError && <p className="text-sm text-destructive">{returnError}</p>}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setReturning(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" disabled={returnMutation.isPending} onClick={submitReturn}>
                {returnMutation.isPending ? t('sales.returnSubmitLoading') : t('sales.returnSubmitButton')}
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
              <tr className="border-b border-border text-start text-muted-foreground">
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
            {sale.returns.length > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('sales.returnsTotalLabel')}</span>
                  <span>-{formatCurrency(returnsTotalAmount, locale)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>{t('sales.netAfterReturnsLabel')}</span>
                  <span>{formatCurrency(netAfterReturns, locale)}</span>
                </div>
              </>
            )}
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

      {sale.returns.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('sales.returnsHistoryTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sale.returns.map((ret) => (
              <div key={ret.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {t('sales.returnNumberPrefix')}
                    {ret.returnNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(ret.createdAt, locale)}</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {ret.items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="py-1.5">{item.product?.name ?? item.productId}</td>
                        <td className="py-1.5 text-end">{item.quantity}</td>
                        <td className="py-1.5 text-end">{formatCurrency(item.total, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-muted-foreground">
                    {ret.user && `${t('sales.returnedByLabel')}: ${ret.user.name}`}
                    {ret.reason && ` — ${t('sales.returnReasonPrefix')}${ret.reason}`}
                  </p>
                  <p className="font-semibold">{formatCurrency(ret.total, locale)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
