'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createCustomer, updateCustomer, type CustomerInput } from '@/lib/customers';
import { useLocale } from '@/i18n/locale-provider';
import type { Customer, CustomerType } from '@/types';

export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const isEdit = Boolean(customer);

  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [type, setType] = useState<CustomerType>(customer?.type ?? 'RETAIL');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const input: CustomerInput = {
        name,
        phone: phone || undefined,
        address: address || undefined,
        type,
      };
      return isEdit && customer ? updateCustomer(customer.id, input) : createCustomer(input);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push(isEdit ? `/customers/${customer!.id}` : `/customers/${result.id}`);
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
            <Label htmlFor="type">{t('customers.typeLabel')}</Label>
            <Select id="type" value={type} onChange={(e) => setType(e.target.value as CustomerType)}>
              <option value="RETAIL">{t('customers.type.RETAIL')}</option>
              <option value="WHOLESALE">{t('customers.type.WHOLESALE')}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{t('common.phone')}</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">{t('common.address')}</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/customers')}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : isEdit ? t('common.saveChanges') : t('customers.addSubmit')}
        </Button>
      </div>
    </form>
  );
}
