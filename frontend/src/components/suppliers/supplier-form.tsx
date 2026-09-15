'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupplier, updateSupplier, type SupplierInput } from '@/lib/suppliers';
import { useLocale } from '@/i18n/locale-provider';
import type { Supplier } from '@/types';

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const isEdit = Boolean(supplier);

  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const input: SupplierInput = { name, phone: phone || undefined, address: address || undefined };
      return isEdit && supplier ? updateSupplier(supplier.id, input) : createSupplier(input);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      router.push(isEdit ? `/suppliers/${supplier!.id}` : `/suppliers/${result.id}`);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message ?? t('common.genericSaveError'));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{t('common.name')}</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{t('common.phone')}</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="address">{t('common.address')}</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/suppliers')}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : isEdit ? t('common.saveChanges') : t('suppliers.addSubmit')}
        </Button>
      </div>
    </form>
  );
}
