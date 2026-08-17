'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adjustProductStock } from '@/lib/products';
import { useLocale } from '@/i18n/locale-provider';
import type { Product } from '@/types';

export function StockAdjustment({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => adjustProductStock(product.id, Number(delta), reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', product.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDelta('');
      setReason('');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">{t('stockAdjustment.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t('stockAdjustment.currentQuantity')}</p>
          <p className="text-lg font-bold">{product.quantity}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delta">{t('stockAdjustment.deltaLabel')}</Label>
          <Input id="delta" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reason">{t('stockAdjustment.reasonLabel')}</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-56" />
        </div>
        <Button type="button" disabled={!delta || mutation.isPending} onClick={() => mutation.mutate()}>
          {t('stockAdjustment.apply')}
        </Button>
        {mutation.isError && <p className="w-full text-sm text-destructive">{t('stockAdjustment.error')}</p>}
      </CardContent>
    </Card>
  );
}
