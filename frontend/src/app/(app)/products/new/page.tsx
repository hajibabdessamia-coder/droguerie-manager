'use client';

import { ProductForm } from '@/components/products/product-form';
import { useLocale } from '@/i18n/locale-provider';

export default function NewProductPage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('products.newTitle')}</h1>
      <ProductForm />
    </div>
  );
}
