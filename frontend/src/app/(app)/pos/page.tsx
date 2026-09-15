'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { PRODUCT_GROUPS } from '@/lib/product-groups';
import { createSale } from '@/lib/sales';
import { fetchStoreSettings } from '@/lib/store-settings';
import { cn, formatCurrency } from '@/lib/utils';
import { useLocale } from '@/i18n/locale-provider';
import type { InvoiceType, PaymentMethod, PriceType, Product, ProductGroup } from '@/types';

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

export default function PosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, locale } = useLocale();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [activeGroup, setActiveGroup] = useState<ProductGroup>('GROUP_1');

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

  const groupProducts = products?.filter((p) => p.group === activeGroup);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('pos.searchPlaceholder')} />

        <div className="flex flex-wrap gap-2">
          {PRODUCT_GROUPS.map((g) => (
            <Button
              key={g}
              type="button"
              variant={activeGroup === g ? 'default' : 'outline'}
              onClick={() => setActiveGroup(g)}
            >
              {t(`productGroups.${g}`)}
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
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-right transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
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
                    <div className="w-16 shrink-0 text-left text-sm font-medium">
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
