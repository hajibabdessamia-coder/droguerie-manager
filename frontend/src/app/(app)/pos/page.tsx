'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { authorizeOverride } from '@/lib/auth';
import { fetchCustomers } from '@/lib/customers';
import { fetchProducts } from '@/lib/products';
import { fetchCategories } from '@/lib/categories';
import { translateCategoryName } from '@/lib/catalog-labels';
import { createSale } from '@/lib/sales';
import { fetchStoreSettings } from '@/lib/store-settings';
import { cn, formatCurrency } from '@/lib/utils';
import { useLocale } from '@/i18n/locale-provider';
import type { InvoiceType, PaymentMethod, PriceType, Product } from '@/types';

interface CartLine {
  productId: string;
  name: string;
  quantity: number;
  priceType: PriceType;
  customPrice?: number;
  wholesalePrice: number;
  retailPrice: number;
  availableQty: number;
}

function resolveUnitPrice(line: CartLine): number {
  if (line.priceType === 'CUSTOM') return line.customPrice ?? 0;
  return line.priceType === 'WHOLESALE' ? line.wholesalePrice : line.retailPrice;
}

const OVERRIDE_TTL_MS = 5 * 60 * 1000;

// لون ثابت لكل فئة بحسب ترتيبها (وليس عشوائياً في كل عرض) — حتى تبقى نفس الفئة
// بنفس اللون دائماً، مما يسهّل التعرّف السريع على التبويبات في نقطة البيع.
// الأصناف الكاملة مكتوبة حرفياً (وليست مُركَّبة بـ template literal) لأن Tailwind
// يفحص الشيفرة المصدرية نصياً بحثاً عن أسماء أصناف كاملة عند البناء
const CATEGORY_TAB_COLORS = [
  {
    active: 'border-rose-600 bg-rose-600 text-white hover:bg-rose-600',
    idle: 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60',
  },
  {
    active: 'border-orange-600 bg-orange-600 text-white hover:bg-orange-600',
    idle: 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-900/60',
  },
  {
    active: 'border-amber-600 bg-amber-600 text-white hover:bg-amber-600',
    idle: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60',
  },
  {
    active: 'border-lime-600 bg-lime-600 text-white hover:bg-lime-600',
    idle: 'border-lime-300 bg-lime-50 text-lime-700 hover:bg-lime-100 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-300 dark:hover:bg-lime-900/60',
  },
  {
    active: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600',
    idle: 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60',
  },
  {
    active: 'border-teal-600 bg-teal-600 text-white hover:bg-teal-600',
    idle: 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/60',
  },
  {
    active: 'border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-600',
    idle: 'border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-900/60',
  },
  {
    active: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-600',
    idle: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60',
  },
  {
    active: 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-600',
    idle: 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60',
  },
  {
    active: 'border-violet-600 bg-violet-600 text-white hover:bg-violet-600',
    idle: 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/60',
  },
  {
    active: 'border-fuchsia-600 bg-fuchsia-600 text-white hover:bg-fuchsia-600',
    idle: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/60',
  },
  {
    active: 'border-pink-600 bg-pink-600 text-white hover:bg-pink-600',
    idle: 'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-950/40 dark:text-pink-300 dark:hover:bg-pink-900/60',
  },
] as const;

function categoryTabColorClasses(index: number, active: boolean) {
  const palette = CATEGORY_TAB_COLORS[index % CATEGORY_TAB_COLORS.length];
  return active ? palette.active : palette.idle;
}

export default function PosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, locale } = useLocale();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  // null = تبويب "الكل" (الافتراضي) — يشمل المنتجات بلا فئة أيضاً، بخلاف السلوك
  // القديم الذي كان يفرض تبويباً واحداً من أربعة ثابتة دائماً نشطاً
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('TICKET');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [taxInitialized, setTaxInitialized] = useState(false);
  const [amountPaid, setAmountPaid] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const [overrideToken, setOverrideToken] = useState<string | null>(null);
  const [overrideExpiresAt, setOverrideExpiresAt] = useState<number | null>(null);
  const [overrideEmail, setOverrideEmail] = useState('');
  const [overridePassword, setOverridePassword] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ['pos-products', debouncedSearch],
    queryFn: () => fetchProducts({ search: debouncedSearch || undefined }),
  });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => fetchCustomers() });
  const { data: settings } = useQuery({ queryKey: ['store-settings'], queryFn: fetchStoreSettings });

  useEffect(() => {
    if (settings && !taxInitialized) {
      setTaxRate(settings.defaultTaxRate);
      setTaxInitialized(true);
    }
  }, [settings, taxInitialized]);

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  function defaultPriceType(): PriceType {
    return selectedCustomer?.type === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
  }

  function addProductToCart(product: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          priceType: defaultPriceType(),
          wholesalePrice: Number(product.wholesalePrice),
          retailPrice: Number(product.retailPrice),
          availableQty: product.quantity,
        },
      ];
    });
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function changeQty(productId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  const subtotal = lines.reduce((sum, l) => sum + resolveUnitPrice(l) * l.quantity, 0);
  const discountNum = Number(discount) || 0;
  const taxRateNum = Number(taxRate) || 0;
  const taxable = Math.max(0, subtotal - discountNum);
  const taxAmount = taxable * (taxRateNum / 100);
  const total = taxable + taxAmount;
  const amountPaidNum = Number(amountPaid) || 0;
  const changeDue = Math.max(0, amountPaidNum - total);

  const hasCustomLine = lines.some((l) => l.priceType === 'CUSTOM');
  const overrideValid = Boolean(overrideToken && overrideExpiresAt && Date.now() < overrideExpiresAt);

  const overrideMutation = useMutation({
    mutationFn: () => authorizeOverride(overrideEmail, overridePassword),
    onSuccess: (token) => {
      setOverrideToken(token);
      setOverrideExpiresAt(Date.now() + OVERRIDE_TTL_MS);
      setOverrideError(null);
      setOverridePassword('');
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setOverrideError(message ?? t('pos.overrideAuthFailed'));
    },
  });

  const saleMutation = useMutation({
    mutationFn: () =>
      createSale({
        customerId: customerId || undefined,
        invoiceType,
        paymentMethod,
        discount: discountNum,
        taxRate: taxRateNum,
        amountPaid: amountPaidNum,
        overrideToken: hasCustomLine ? (overrideToken ?? undefined) : undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          priceType: l.priceType,
          ...(l.priceType === 'CUSTOM' ? { customPrice: l.customPrice ?? 0 } : {}),
        })),
      }),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      router.push(`/pos/receipt/${sale.id}`);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message ?? t('pos.genericSaleError'));
    },
  });

  function handleSubmit() {
    setError(null);
    if (lines.length === 0) return setError(t('pos.cartEmpty'));
    if (paymentMethod === 'CREDIT' && !customerId) return setError(t('pos.creditRequiresCustomer'));
    if (hasCustomLine && !overrideValid) return setError(t('pos.customPriceAuthRequired'));
    saleMutation.mutate();
  }

  // قارئ الباركود يعمل كلوحة مفاتيح: يكتب الرمز بسرعة ثم يُرسل Enter. نطلب البيانات
  // مباشرة هنا (بدل الاعتماد على قائمة "products" المحمَّلة عبر debouncedSearch) لأن
  // الطلب المؤجَّل (300ms) قد لا يكون واكب آخر ما كُتب بعد عند وصول Enter — التطابق هنا
  // تام (=== وليس "يحتوي") حتى لا يُضاف منتج خطأ من نتيجة جزئية بالصدفة
  async function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = search.trim();
    if (!code) return;
    const results = await fetchProducts({ search: code });
    const exact = results.find((p) => p.barcode === code || p.internalCode === code);
    if (exact) {
      addProductToCart(exact);
      setSearch('');
    }
  }

  const groupProducts = activeCategoryId ? products?.filter((p) => p.categoryId === activeCategoryId) : products;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={t('pos.searchPlaceholder')}
          autoFocus
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={activeCategoryId === null ? 'default' : 'outline'} onClick={() => setActiveCategoryId(null)}>
            {t('pos.allCategoriesTab')}
          </Button>
          {categories?.map((c, index) => (
            <Button
              key={c.id}
              type="button"
              variant="outline"
              onClick={() => setActiveCategoryId(c.id)}
              className={categoryTabColorClasses(index, activeCategoryId === c.id)}
            >
              {translateCategoryName(c.name, locale)}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {groupProducts?.map((p) => {
            const low = p.quantity <= p.minStock;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addProductToCart(p)}
                disabled={p.quantity <= 0}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-16 w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    {t('products.noImage')}
                  </div>
                )}
                <div className="flex w-full items-center gap-1.5">
                  <span
                    className={cn('h-2.5 w-2.5 shrink-0 rounded-full', low ? 'bg-destructive' : 'bg-green-500')}
                    title={low ? t('pos.lowStockTooltip') : t('pos.goodStockTooltip')}
                  />
                  <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                </div>
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-semibold text-primary">{formatCurrency(p.retailPrice, locale)}</span>
                  <Badge variant={low ? 'destructive' : 'secondary'}>{p.quantity}</Badge>
                </div>
              </button>
            );
          })}
          {groupProducts?.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">{t('products.emptyState')}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('pos.cartTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{t('common.walkInCustomer')}</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'WHOLESALE' ? t('customers.type.WHOLESALE') : t('customers.type.RETAIL')})
                </option>
              ))}
            </Select>

            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {lines.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('pos.cartEmpty')}</p>}
              {lines.map((line) => (
                <div key={line.productId} className="flex flex-col gap-2 rounded-lg border border-border p-2">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{line.name}</p>
                    <div className="w-16 shrink-0 text-end text-sm font-medium">
                      {formatCurrency(resolveUnitPrice(line) * line.quantity, locale)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeLine(line.productId)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={line.priceType}
                        onChange={(e) => updateLine(line.productId, { priceType: e.target.value as PriceType })}
                        className="h-8 w-24 text-xs"
                      >
                        <option value="RETAIL">{t('pos.priceType.RETAIL')}</option>
                        <option value="WHOLESALE">{t('pos.priceType.WHOLESALE')}</option>
                        <option value="CUSTOM">{t('pos.priceType.CUSTOM')}</option>
                      </Select>
                      {line.priceType === 'CUSTOM' && (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8 w-20 text-xs"
                          value={line.customPrice ?? ''}
                          onChange={(e) => updateLine(line.productId, { customPrice: Number(e.target.value) })}
                          placeholder={t('pos.customPricePlaceholder')}
                        />
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => changeQty(line.productId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm">{line.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => changeQty(line.productId, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasCustomLine && !overrideValid && (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-destructive/50 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <ShieldCheck className="h-4 w-4" />
                  {t('pos.customPriceAuthRequired')}
                </p>
                <Input
                  type="email"
                  placeholder={t('pos.managerEmailPlaceholder')}
                  value={overrideEmail}
                  onChange={(e) => setOverrideEmail(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  type="password"
                  placeholder={t('login.passwordLabel')}
                  value={overridePassword}
                  onChange={(e) => setOverridePassword(e.target.value)}
                  className="h-8 text-xs"
                />
                {overrideError && <p className="text-xs text-destructive">{overrideError}</p>}
                <Button
                  type="button"
                  size="sm"
                  disabled={!overrideEmail || !overridePassword || overrideMutation.isPending}
                  onClick={() => overrideMutation.mutate()}
                >
                  {t('pos.authorizeButton')}
                </Button>
              </div>
            )}
            {hasCustomLine && overrideValid && (
              <p className="flex items-center gap-1.5 text-sm text-primary">
                <ShieldCheck className="h-4 w-4" />
                {t('pos.managerAuthorized')}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoiceType">{t('sales.invoiceTypeLabel')}</Label>
                <Select id="invoiceType" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}>
                  <option value="TICKET">{t('sales.invoiceType.TICKET')}</option>
                  <option value="LEGAL">{t('sales.invoiceType.LEGAL')}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="paymentMethod">{t('sales.paymentMethodLabel')}</Label>
                <Select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value="CASH">{t('sales.paymentMethod.CASH')}</option>
                  <option value="CREDIT">{t('sales.paymentMethod.CREDIT')}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="discount">{t('sales.discountLabel')}</Label>
                <Input id="discount" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="taxRate">{t('sales.taxRateFormLabel')}</Label>
                <Input id="taxRate" type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="amountPaid">{t('sales.amountPaidFormLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="amountPaid"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={() => setAmountPaid(total.toFixed(2))}>
                    {t('pos.exactAmountButton')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('sales.subtotalLabel')}</span>
                <span>{formatCurrency(subtotal, locale)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('sales.taxLabel')}</span>
                <span>{formatCurrency(taxAmount, locale)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>{t('common.grandTotal')}</span>
                <span>{formatCurrency(total, locale)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('sales.changeDueLabel')}</span>
                <span>{formatCurrency(changeDue, locale)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="button"
              size="lg"
              disabled={saleMutation.isPending}
              onClick={handleSubmit}
              className={cn('mt-1')}
            >
              {saleMutation.isPending ? t('pos.completeSaleLoading') : t('pos.completeSaleButton')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
