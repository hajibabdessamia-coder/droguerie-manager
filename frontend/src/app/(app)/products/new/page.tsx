import { ProductForm } from '@/components/products/product-form';

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">إضافة منتج جديد</h1>
      <ProductForm />
    </div>
  );
}
