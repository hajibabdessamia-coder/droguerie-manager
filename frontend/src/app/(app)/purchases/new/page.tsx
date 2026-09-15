'use client';

import { PurchaseForm } from '@/components/purchases/purchase-form';
import { useLocale } from '@/i18n/locale-provider';

export default function NewPurchasePage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('purchases.addNew')}</h1>
      <PurchaseForm />
    </div>
  );
}
