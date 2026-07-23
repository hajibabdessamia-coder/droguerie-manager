'use client';

import { useQuery } from '@tanstack/react-query';
import { ProductForm } from '@/components/products/product-form';
import { StockAdjustment } from '@/components/products/stock-adjustment';
import { fetchProduct } from '@/lib/products';
import { useRouteId } from '@/lib/use-route-id';

export default function EditProductPage() {
  const id = useRouteId();
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>;
  if (!product) return <p className="text-sm text-destructive">المنتج غير موجود.</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">تعديل المنتج</h1>
      <ProductForm product={product} />
      <StockAdjustment product={product} />
    </div>
  );
}
