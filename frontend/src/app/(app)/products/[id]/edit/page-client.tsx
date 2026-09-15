'use client';

import { useQuery } from '@tanstack/react-query';
import { ProductForm } from '@/components/products/product-form';
import { StockAdjustment } from '@/components/products/stock-adjustment';
import { fetchProduct } from '@/lib/products';
import { useRouteId } from '@/lib/use-route-id';
import { useLocale } from '@/i18n/locale-provider';

export default function EditProductPage() {
  const id = useRouteId();
  const { t } = useLocale();
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  if (!product) return <p className="text-sm text-destructive">{t('products.notFound')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('products.editTitle')}</h1>
      <ProductForm product={product} />
      <StockAdjustment product={product} />
    </div>
  );
}
