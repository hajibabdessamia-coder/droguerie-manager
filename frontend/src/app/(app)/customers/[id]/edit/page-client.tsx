'use client';

import { useQuery } from '@tanstack/react-query';
import { CustomerForm } from '@/components/customers/customer-form';
import { fetchCustomer } from '@/lib/customers';
import { useRouteId } from '@/lib/use-route-id';
import { useLocale } from '@/i18n/locale-provider';

export default function EditCustomerPage() {
  const id = useRouteId();
  const { t } = useLocale();
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomer(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  if (!customer) return <p className="text-sm text-destructive">{t('customers.notFound')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('customers.editTitle')}</h1>
      <CustomerForm customer={customer} />
    </div>
  );
}
