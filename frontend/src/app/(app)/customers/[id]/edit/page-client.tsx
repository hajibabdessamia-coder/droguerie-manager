'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CustomerForm } from '@/components/customers/customer-form';
import { fetchCustomer } from '@/lib/customers';

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomer(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>;
  if (!customer) return <p className="text-sm text-destructive">الزبون غير موجود.</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">تعديل الزبون</h1>
      <CustomerForm customer={customer} />
    </div>
  );
}
