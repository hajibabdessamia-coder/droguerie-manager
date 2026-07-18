import { SupplierForm } from '@/components/suppliers/supplier-form';

export default function NewSupplierPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">إضافة مورد جديد</h1>
      <SupplierForm />
    </div>
  );
}
