'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adjustProductStock } from '@/lib/products';
import type { Product } from '@/types';

export function StockAdjustment({ product }: { product: Product }) {
  const queryClient = useQueryClient();
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
        <CardTitle className="text-base font-semibold text-foreground">تعديل المخزون يدوياً</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-sm text-muted-foreground">الكمية الحالية</p>
          <p className="text-lg font-bold">{product.quantity}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delta">الكمية (+ إضافة / - خصم)</Label>
          <Input id="delta" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reason">السبب (اختياري)</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-56" />
        </div>
        <Button type="button" disabled={!delta || mutation.isPending} onClick={() => mutation.mutate()}>
          تطبيق
        </Button>
      </CardContent>
    </Card>
  );
}
