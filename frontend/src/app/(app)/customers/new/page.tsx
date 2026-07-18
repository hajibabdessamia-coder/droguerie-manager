import { CustomerForm } from '@/components/customers/customer-form';

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">إضافة زبون جديد</h1>
      <CustomerForm />
    </div>
  );
}
