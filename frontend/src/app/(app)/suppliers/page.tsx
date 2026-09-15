'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { fetchSuppliers } from '@/lib/suppliers';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useLocale } from '@/i18n/locale-provider';

export default function SuppliersPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { t, locale } = useLocale();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: suppliers, isLoading, isError } = useQuery({
    queryKey: ['suppliers', debouncedSearch],
    queryFn: () => fetchSuppliers(debouncedSearch || undefined),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('suppliers.pageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {suppliers ? `${suppliers.length} ${t('suppliers.countSuffix')}` : '...'}
          </p>
        </div>
        {isAdmin && (
          <Link href="/suppliers/new" className={buttonVariants({ size: 'default' })}>
            <Plus className="h-4 w-4" />
            {t('suppliers.addSupplier')}
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.searchByNamePlaceholder')}
              className="pe-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-start text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('common.name')}</th>
                <th className="px-4 py-3 font-medium">{t('common.phone')}</th>
                <th className="px-4 py-3 font-medium">{t('common.address')}</th>
                <th className="px-4 py-3 font-medium">{t('common.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-destructive">
                    {t('suppliers.loadError')}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && suppliers?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    {t('suppliers.emptyState')}
                  </td>
                </tr>
              )}
              {!isError && suppliers?.map((s) => {
                const balance = Number(s.balance);
                return (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link href={`/suppliers/${s.id}`} className="font-medium text-primary hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.address ?? '—'}</td>
                    <td className={cn('px-4 py-3 font-medium', balance > 0 && 'text-destructive')}>
                      {formatCurrency(s.balance, locale)}
                    </td>
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
