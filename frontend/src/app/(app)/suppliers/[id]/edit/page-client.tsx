'use client';

import { useQuery } from '@tanstack/react-query';
import { SupplierForm } from '@/components/suppliers/supplier-form';
import { fetchSupplier } from '@/lib/suppliers';
import { useRouteId } from '@/lib/use-route-id';

export default function EditSupplierPage() {
  const id = useRouteId();
  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => fetchSupplier(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>;
  if (!supplier) return <p className="text-sm text-destructive">المورد غير موجود.</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">تعديل المورد</h1>
      <SupplierForm supplier={supplier} />
    </div>
  );
}
