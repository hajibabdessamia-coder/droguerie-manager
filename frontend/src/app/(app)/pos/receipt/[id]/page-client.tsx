'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSale } from '@/lib/sales';
import { fetchStoreSettings } from '@/lib/store-settings';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useRouteId } from '@/lib/use-route-id';
import { useLocale } from '@/i18n/locale-provider';

export default function ReceiptPage() {
  const id = useRouteId();
  const { t, locale } = useLocale();
  const { data: sale, isLoading } = useQuery({ queryKey: ['sale', id], queryFn: () => fetchSale(id) });
  const { data: settings } = useQuery({ queryKey: ['store-settings'], queryFn: fetchStoreSettings });

  if (isLoading) return <Skeleton className="mx-auto h-96 w-full max-w-2xl" />;
  if (!sale) return <p className="text-sm text-destructive">{t('sales.notFound')}</p>;

  const isLegal = sale.invoiceType === 'LEGAL';

  return (
    <div className="flex flex-col gap-4">
      <style>{`@media print { @page { size: ${isLegal ? 'A4' : '80mm auto'}; margin: ${isLegal ? '12mm' : '2mm'}; } }`}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link href="/pos" className={buttonVariants({ variant: 'outline' })}>
          {t('pos.newSaleLink')}
        </Link>
        <button type="button" onClick={() => window.print()} className={buttonVariants({})}>
          <Printer className="h-4 w-4" />
          {t('pos.printButton')}
        </button>
      </div>

      {isLegal ? (
        <div className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-white p-8 text-black print:rounded-none print:border-0 print:p-0">
          <div className="flex items-start justify-between border-b border-gray-300 pb-4">
            <div>
              {settings?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoUrl} alt="" className="mb-2 h-14" />
              )}
              <h2 className="text-xl font-bold">{settings?.name}</h2>
              {settings?.address && <p className="text-sm text-gray-600">{settings.address}</p>}
              {settings?.phone && <p className="text-sm text-gray-600">{settings.phone}</p>}
            </div>
            <div className="text-left text-sm">
              <p className="text-lg font-bold">
                {t('pos.receiptInvoiceNumberPrefix')}
                {sale.invoiceNumber}
              </p>
              <p className="text-gray-600">{formatDateTime(sale.createdAt, locale)}</p>
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between text-sm">
            <p>
              <span className="font-semibold">{t('common.customerLabel')}: </span>
              {sale.customer?.name ?? t('common.walkInCustomer')}
            </p>
            <div className="space-y-0.5 text-left text-xs text-gray-600">
              {settings?.ifNumber && <p>IF: {settings.ifNumber}</p>}
              {settings?.ice && <p>ICE: {settings.ice}</p>}
              {settings?.rc && <p>RC: {settings.rc}</p>}
              {settings?.patente && <p>Patente: {settings.patente}</p>}
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-800 text-right">
                <th className="py-2 font-semibold">{t('common.product')}</th>
                <th className="py-2 font-semibold">{t('common.quantity')}</th>
                <th className="py-2 font-semibold">{t('sales.unitPriceColumn')}</th>
                <th className="py-2 font-semibold">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-2">{item.product?.name ?? item.productId}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2">{formatCurrency(item.unitPrice, locale)}</td>
                  <td className="py-2">{formatCurrency(item.total, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>{t('sales.subtotalLabel')}</span>
                <span>{formatCurrency(sale.subtotal, locale)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{t('sales.discountLabel')}</span>
                <span>{formatCurrency(sale.discount, locale)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>TVA ({Number(sale.taxRate)}%)</span>
                <span>{formatCurrency(sale.taxAmount, locale)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-1 text-base font-bold">
                <span>{t('common.grandTotal')}</span>
                <span>{formatCurrency(sale.total, locale)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{t('sales.paidLabel')}</span>
                <span>{formatCurrency(sale.amountPaid, locale)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{t('sales.changeDueLabel')}</span>
                <span>{formatCurrency(sale.changeDue, locale)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-xs rounded-xl border border-border bg-white p-4 font-mono text-xs text-black print:rounded-none print:border-0">
          <div className="text-center">
            <p className="text-sm font-bold">{settings?.name}</p>
            {settings?.address && <p>{settings.address}</p>}
            {settings?.phone && <p>{settings.phone}</p>}
          </div>
          <div className="my-2 border-t border-dashed border-gray-500" />
          <p>
            {t('pos.receiptTicketNumberPrefix')}
            {sale.invoiceNumber}
          </p>
          <p>{formatDateTime(sale.createdAt, locale)}</p>
          <div className="my-2 border-t border-dashed border-gray-500" />
          {sale.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-2">
              <span className="truncate">
                {item.product?.name ?? item.productId} × {item.quantity}
              </span>
              <span className="shrink-0">{formatCurrency(item.total, locale)}</span>
            </div>
          ))}
          <div className="my-2 border-t border-dashed border-gray-500" />
          <div className="flex justify-between font-bold">
            <span>{t('common.grandTotal')}</span>
            <span>{formatCurrency(sale.total, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('sales.paidLabel')}</span>
            <span>{formatCurrency(sale.amountPaid, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('sales.changeDueLabel')}</span>
            <span>{formatCurrency(sale.changeDue, locale)}</span>
          </div>
          <p className="mt-3 text-center">{t('pos.receiptThankYou')}</p>
        </div>
      )}
    </div>
  );
}
