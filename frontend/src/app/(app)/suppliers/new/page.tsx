'use client';

import { SupplierForm } from '@/components/suppliers/supplier-form';
import { useLocale } from '@/i18n/locale-provider';

export default function NewSupplierPage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('suppliers.newTitle')}</h1>
      <SupplierForm />
    </div>
  );
}
