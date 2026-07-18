'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { fetchManufacturers } from '@/lib/manufacturers';
import { deleteProduct, fetchProducts } from '@/lib/products';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

export default function ProductsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [manufacturerId, setManufacturerId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data: manufacturers } = useQuery({ queryKey: ['manufacturers'], queryFn: fetchManufacturers });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', debouncedSearch, manufacturerId, lowStockOnly],
    queryFn: () =>
      fetchProducts({
        search: debouncedSearch || undefined,
        manufacturerId: manufacturerId || undefined,
        lowStock: lowStockOnly,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  function handleDelete(id: string, name: string) {
    if (window.confirm(`هل تريد حذف المنتج "${name}"؟`)) deleteMutation.mutate(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{products ? `${products.length} منتج` : '...'}</p>
        </div>
        {isAdmin && (
          <Link href="/products/new" className={buttonVariants({ size: 'default' })}>
            <Plus className="h-4 w-4" />
            إضافة منتج
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الكود..."
              className="pr-9"
            />
          </div>
          <Select
            value={manufacturerId}
            onChange={(e) => setManufacturerId(e.target.value)}
            className="w-auto min-w-[150px]"
          >
            <option value="">كل الشركات المصنعة</option>
            {manufacturers?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant={lowStockOnly ? 'default' : 'outline'}
            onClick={() => setLowStockOnly((v) => !v)}
          >
            <AlertTriangle className="h-4 w-4" />
            قليلة المخزون فقط
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-right text-muted-foreground">
                <th className="px-4 py-3 font-medium">المنتج</th>
                <th className="px-4 py-3 font-medium">الكود</th>
                <th className="px-4 py-3 font-medium">الكمية</th>
                <th className="px-4 py-3 font-medium">سعر التقسيط</th>
                <th className="px-4 py-3 font-medium">سعر الجملة</th>
                {isAdmin && <th className="px-4 py-3 font-medium">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {!isLoading && products?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    لا توجد منتجات مطابقة.
                  </td>
                </tr>
              )}
              {products?.map((p) => {
                const low = p.quantity <= p.minStock;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                            لا صورة
                          </div>
                        )}
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.internalCode}</td>
                    <td className="px-4 py-3">
                      <Badge variant={low ? 'destructive' : 'secondary'}>
                        {p.quantity} / {p.minStock}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(p.retailPrice)}</td>
                    <td className="px-4 py-3">{formatCurrency(p.wholesalePrice)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/products/${p.id}/edit`}
                            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.name)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
