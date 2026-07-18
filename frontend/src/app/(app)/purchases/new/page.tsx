import { PurchaseForm } from '@/components/purchases/purchase-form';

export default function NewPurchasePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">فاتورة شراء جديدة</h1>
      <PurchaseForm />
    </div>
  );
}
