'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createPurchase } from '@/lib/purchases';
import { fetchProducts } from '@/lib/products';
import { fetchSuppliers } from '@/lib/suppliers';
import { formatCurrency } from '@/lib/utils';
import { useLocale } from '@/i18n/locale-provider';

interface PurchaseLine {
  productId: string;
  quantity: string;
  purchasePrice: string;
}

function emptyLine(): PurchaseLine {
  return { productId: '', quantity: '1', purchasePrice: '' };
}

export function PurchaseForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, locale } = useLocale();

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => fetchSuppliers() });
  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => fetchProducts() });

  const [supplierId, setSupplierId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  function updateLine(index: number, patch: Partial<PurchaseLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.purchasePrice) || 0), 0);

  const mutation = useMutation({
    mutationFn: () =>
      createPurchase({
        supplierId,
        invoiceRef: invoiceRef || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          purchasePrice: Number(l.purchasePrice),
        })),
      }),
    onSuccess: async (purchase) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchases'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
      ]);
      router.push(`/purchases/${purchase.id}`);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message ?? t('common.genericSaveError'));
    },
  });

  function handleSubmit() {
    setError(null);
    if (!supplierId) return setError(t('purchases.validationSelectSupplier'));
    if (lines.length === 0) return setError(t('purchases.validationAddLine'));
    if (lines.some((l) => !l.productId || !l.quantity || !l.purchasePrice)) {
      return setError(t('purchases.validationCompleteLines'));
    }
    mutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplierId">{t('purchases.supplierLabel')}</Label>
            <Select id="supplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{t('purchases.selectSupplierPlaceholder')}</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoiceRef">{t('purchases.invoiceRefOptionalLabel')}</Label>
            <Input id="invoiceRef" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">{t('common.productsSectionTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lines.map((line, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <Label>{t('common.product')}</Label>
                <Select value={line.productId} onChange={(e) => updateLine(index, { productId: e.target.value })}>
                  <option value="">{t('purchases.selectProductPlaceholder')}</option>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex w-28 flex-col gap-1.5">
                <Label>{t('common.quantity')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                />
              </div>
              <div className="flex w-32 flex-col gap-1.5">
                <Label>{t('common.purchasePrice')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.purchasePrice}
                  onChange={(e) => updateLine(index, { purchasePrice: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(index)}
                disabled={lines.length === 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addLine} className="self-start">
            <Plus className="h-4 w-4" />
            {t('purchases.addLineButton')}
          </Button>

          <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
            <span>{t('common.grandTotal')}</span>
            <span>{formatCurrency(total, locale)}</span>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/purchases')}>
          {t('common.cancel')}
        </Button>
        <Button type="button" disabled={mutation.isPending} onClick={handleSubmit}>
          {mutation.isPending ? t('common.saving') : t('purchases.saveButton')}
        </Button>
      </div>
    </div>
  );
}
