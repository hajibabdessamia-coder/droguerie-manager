'use client';

import { CustomerForm } from '@/components/customers/customer-form';
import { useLocale } from '@/i18n/locale-provider';

export default function NewCustomerPage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('customers.newTitle')}</h1>
      <CustomerForm />
    </div>
  );
}
