'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BarcodeSvg } from '@/components/products/barcode-svg';
import { fetchProducts, generateBarcode, updateProduct } from '@/lib/products';
import { printPage } from '@/lib/print';
import { useLocale } from '@/i18n/locale-provider';
import type { Product } from '@/types';

export default function BarcodeLabelsPage() {
  const { t, dir } = useLocale();
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => fetchProducts() });

  // qty لكل منتج: 0 يعني غير مُختار (لا يظهر في صفحة الطباعة). خريطة بدل مصفوفة حتى
  // يبقى العدد المُدخل محفوظاً لكل منتج حتى لو تغيّر ترتيب/تصفية القائمة لاحقاً
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const generateMutation = useMutation({
    mutationFn: async (product: Product) => {
      const barcode = await generateBarcode();
      return updateProduct(product.id, {
        name: product.name,
        internalCode: product.internalCode,
        barcode,
        categoryId: product.categoryId ?? undefined,
        unitId: product.unitId ?? undefined,
        manufacturerId: product.manufacturerId ?? undefined,
        purchasePrice: Number(product.purchasePrice),
        retailPrice: Number(product.retailPrice),
        wholesalePrice: Number(product.wholesalePrice),
        minStock: product.minStock,
        notes: product.notes ?? undefined,
        imageUrl: product.imageUrl ?? undefined,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const labels = useMemo(() => {
    const out: { product: Product; copyIndex: number }[] = [];
    for (const p of products ?? []) {
      if (!p.barcode) continue;
      const qty = quantities[p.id] ?? 0;
      for (let i = 0; i < qty; i++) out.push({ product: p, copyIndex: i });
    }
    return out;
  }, [products, quantities]);

  function setQty(id: string, value: number) {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.min(99, value)) }));
  }

  return (
    <div className="flex flex-col gap-6">
      <style>{'@media print { @page { size: A4; margin: 10mm; } }'}</style>

      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link href="/products" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <BackIcon className="h-4 w-4" />
            {t('products.pageTitle')}
          </Link>
          <h1 className="text-2xl font-bold">{t('barcodeLabels.pageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('barcodeLabels.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => printPage('document')} disabled={labels.length === 0}>
          <Printer className="h-4 w-4" />
          {t('barcodeLabels.printButton')}
        </Button>
      </div>

      <Card className="print:hidden">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-start text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('products.columns.product')}</th>
                <th className="px-4 py-3 font-medium">{t('productForm.barcodeLabel')}</th>
                <th className="px-4 py-3 font-medium">{t('barcodeLabels.copiesColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {!isLoading && products?.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    {t('products.emptyState')}
                  </td>
                </tr>
              )}
              {products?.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.barcode ?? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generateMutation.mutate(p)}
                        disabled={generateMutation.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t('productForm.generateBarcodeButton')}
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      disabled={!p.barcode}
                      value={quantities[p.id] ?? 0}
                      onChange={(e) => setQty(p.id, Number(e.target.value))}
                      className="w-20"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* منطقة الطباعة فقط — مخفية على الشاشة (screen:hidden غير موجود في Tailwind
          الأساسي، لذا نستخدم print:block/hidden بالاتجاه المعاكس بدل ذلك أدناه) */}
      <div className="hidden grid-cols-3 gap-3 print:grid">
        {labels.map(({ product, copyIndex }) => (
          <div key={`${product.id}-${copyIndex}`} className="flex flex-col items-center rounded-lg border border-gray-300 p-2 text-black">
            <p className="w-full truncate text-center text-xs font-semibold">{product.name}</p>
            <BarcodeSvg value={product.barcode!} height={40} />
          </div>
        ))}
      </div>
    </div>
  );
}
