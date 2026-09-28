import { InternalServerErrorException, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';

const logger = new Logger('PdfUtil');

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], pipe: true });
  } catch (err) {
    logger.error('Puppeteer failed to launch (PDF generation)', err instanceof Error ? err.stack : err);
    throw new InternalServerErrorException({ code: 'PDF_GENERATION_FAILED' });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
    });
    return Buffer.from(pdf);
  } catch (err) {
    logger.error('PDF generation failed', err instanceof Error ? err.stack : err);
    throw new InternalServerErrorException({ code: 'PDF_GENERATION_FAILED' });
  } finally {
    await browser.close();
  }
}

// نفس منطق تنسيق العملة في frontend/src/lib/utils.ts (CURRENCY_SUFFIX) — رمز الدرهم
// بالحروف العربية في الوضع العربي، واختصار MAD في الوضع الفرنسي
function formatCurrency(value: number, locale: InvoiceLocale = 'ar'): string {
  const formatted = value.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return locale === 'ar' ? `${formatted} د.م.` : `${formatted} MAD`;
}

function formatDate(value: Date, locale: InvoiceLocale = 'ar'): string {
  return value.toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR');
}

export type InvoiceLocale = 'ar' | 'fr';

const INVOICE_LABELS: Record<InvoiceLocale, {
  invoiceNumberPrefix: string;
  productCol: string;
  qtyCol: string;
  priceCol: string;
  totalCol: string;
  subtotal: string;
  discount: string;
  tax: string;
  grandTotal: string;
  paid: string;
  changeDue: string;
  walkInCustomer: string;
}> = {
  ar: {
    invoiceNumberPrefix: 'فاتورة رقم',
    productCol: 'المنتج',
    qtyCol: 'الكمية',
    priceCol: 'السعر',
    totalCol: 'المجموع',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم',
    tax: 'الضريبة',
    grandTotal: 'الإجمالي',
    paid: 'المدفوع',
    changeDue: 'الباقي',
    walkInCustomer: 'زبون عابر',
  },
  fr: {
    invoiceNumberPrefix: 'Facture N°',
    productCol: 'Produit',
    qtyCol: 'Quantité',
    priceCol: 'Prix',
    totalCol: 'Total',
    subtotal: 'Sous-total',
    discount: 'Remise',
    tax: 'Taxe',
    grandTotal: 'Total général',
    paid: 'Payé',
    changeDue: 'Monnaie rendue',
    walkInCustomer: 'Client de passage',
  },
};

export function invoiceWalkInCustomerLabel(locale: InvoiceLocale): string {
  return INVOICE_LABELS[locale].walkInCustomer;
}

interface ProductStat {
  name: string;
  qty: number;
  revenue: number;
}

export interface SummaryReportData {
  periodLabel: string;
  start: Date;
  end: Date;
  grossSalesTotal: number;
  salesTotal: number;
  returnsTotal: number;
  profitTotal: number;
  invoiceCount: number;
  purchasesValue: number;
  inventoryValue: number;
  topProducts: ProductStat[];
  leastProducts: ProductStat[];
  returnedProducts: ProductStat[];
}

export const SUMMARY_LABELS: Record<InvoiceLocale, {
  reportTitlePrefix: string;
  fromLabel: string;
  toLabel: string;
  totalSales: string;
  grossSalesLabel: string;
  breakdownEquals: string;
  returnsTotal: string;
  returnsNote: string;
  profit: string;
  invoiceCount: string;
  purchasesValue: string;
  inventoryValue: string;
  topProducts: string;
  leastProducts: string;
  returnedProducts: string;
  productCol: string;
  qtySoldCol: string;
  revenueCol: string;
  qtyReturnedCol: string;
  returnedValueCol: string;
  noData: string;
}> = {
  ar: {
    reportTitlePrefix: 'تقرير',
    fromLabel: 'من',
    toLabel: 'إلى',
    totalSales: 'صافي المبيعات',
    grossSalesLabel: 'إجمالي المبيعات',
    breakdownEquals: 'الصافي',
    returnsTotal: 'قيمة المرتجعات',
    returnsNote: 'المرتجعات تُحسب بتاريخ الإرجاع نفسه، وليس بتاريخ الفاتورة الأصلية.',
    profit: 'الأرباح',
    invoiceCount: 'عدد الفواتير',
    purchasesValue: 'قيمة المشتريات',
    inventoryValue: 'قيمة المخزون',
    topProducts: 'أفضل المنتجات مبيعاً',
    leastProducts: 'أقل المنتجات مبيعاً',
    returnedProducts: 'المنتجات المرجعة',
    productCol: 'المنتج',
    qtySoldCol: 'الكمية المباعة',
    revenueCol: 'الإيراد',
    qtyReturnedCol: 'الكمية المرجعة',
    returnedValueCol: 'قيمة الإرجاع',
    noData: 'لا توجد بيانات',
  },
  fr: {
    reportTitlePrefix: 'Rapport',
    fromLabel: 'Du',
    toLabel: 'au',
    totalSales: 'Ventes nettes',
    grossSalesLabel: 'Ventes totales',
    breakdownEquals: 'Net',
    returnsTotal: 'Total des retours',
    returnsNote: "Les retours sont comptabilisés à la date du retour lui-même, et non à la date de la facture d'origine.",
    profit: 'Bénéfices',
    invoiceCount: 'Nombre de factures',
    purchasesValue: 'Valeur des achats',
    inventoryValue: 'Valeur du stock',
    topProducts: 'Meilleurs produits vendus',
    leastProducts: 'Produits les moins vendus',
    returnedProducts: 'Produits retournés',
    productCol: 'Produit',
    qtySoldCol: 'Quantité vendue',
    revenueCol: 'Revenu',
    qtyReturnedCol: 'Quantité retournée',
    returnedValueCol: 'Valeur retournée',
    noData: 'Aucune donnée',
  },
};

export function buildSummaryReportHtml(report: SummaryReportData, locale: InvoiceLocale = 'ar'): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const l = SUMMARY_LABELS[locale];
  const productRow = (p: ProductStat) =>
    `<tr><td>${p.name}</td><td>${p.qty}</td><td>${formatCurrency(p.revenue, locale)}</td></tr>`;
  const emptyRow = `<tr><td colspan="3">${l.noData}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .muted { color: #666; font-size: 12px; margin-bottom: 24px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; min-width: 150px; }
  .card .label { font-size: 11px; color: #666; }
  .card .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
  .card .breakdown { font-size: 11px; color: #666; margin-top: 4px; }
  .note { font-size: 11px; color: #888; margin: -12px 0 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: start; }
  th { background: #f5f5f5; }
  h2 { font-size: 15px; margin: 16px 0 8px; }
</style>
</head>
<body>
  <h1>${l.reportTitlePrefix} ${report.periodLabel}</h1>
  <p class="muted">${l.fromLabel} ${formatDate(report.start, locale)} ${l.toLabel} ${formatDate(report.end, locale)}</p>

  <div class="grid">
    <div class="card">
      <div class="label">${l.totalSales}</div>
      <div class="value">${formatCurrency(report.salesTotal, locale)}</div>
      <div class="breakdown">${formatCurrency(report.grossSalesTotal, locale)} − ${formatCurrency(report.returnsTotal, locale)} = ${l.breakdownEquals} ${formatCurrency(report.salesTotal, locale)}</div>
    </div>
    <div class="card"><div class="label">${l.returnsTotal}</div><div class="value">${formatCurrency(report.returnsTotal, locale)}</div></div>
    <div class="card"><div class="label">${l.profit}</div><div class="value">${formatCurrency(report.profitTotal, locale)}</div></div>
    <div class="card"><div class="label">${l.invoiceCount}</div><div class="value">${report.invoiceCount}</div></div>
    <div class="card"><div class="label">${l.purchasesValue}</div><div class="value">${formatCurrency(report.purchasesValue, locale)}</div></div>
    <div class="card"><div class="label">${l.inventoryValue}</div><div class="value">${formatCurrency(report.inventoryValue, locale)}</div></div>
  </div>

  <p class="note">${l.returnsNote}</p>

  <h2>${l.topProducts}</h2>
  <table>
    <thead><tr><th>${l.productCol}</th><th>${l.qtySoldCol}</th><th>${l.revenueCol}</th></tr></thead>
    <tbody>${report.topProducts.map(productRow).join('') || emptyRow}</tbody>
  </table>

  <h2>${l.leastProducts}</h2>
  <table>
    <thead><tr><th>${l.productCol}</th><th>${l.qtySoldCol}</th><th>${l.revenueCol}</th></tr></thead>
    <tbody>${report.leastProducts.map(productRow).join('') || emptyRow}</tbody>
  </table>

  <h2>${l.returnedProducts}</h2>
  <table>
    <thead><tr><th>${l.productCol}</th><th>${l.qtyReturnedCol}</th><th>${l.returnedValueCol}</th></tr></thead>
    <tbody>${report.returnedProducts.map(productRow).join('') || emptyRow}</tbody>
  </table>
</body>
</html>`;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date;
  customerName: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  changeDue: number;
  store: {
    name: string;
    address?: string | null;
    phone?: string | null;
    ifNumber?: string | null;
    ice?: string | null;
    rc?: string | null;
    patente?: string | null;
  };
  locale?: InvoiceLocale;
}

export function buildInvoiceHtml(data: InvoicePdfData): string {
  const locale = data.locale ?? 'ar';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const l = INVOICE_LABELS[locale];

  const itemRow = (item: InvoicePdfData['items'][number]) =>
    `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${formatCurrency(item.unitPrice, locale)}</td><td>${formatCurrency(item.total, locale)}</td></tr>`;

  // سطر أرقام تعريف المحل (IF/ICE/RC/Patente) — كانت البيانات تُستقبَل هنا (راجع
  // InvoicePdfData.store) لكن لم تكن تُطبَع إطلاقاً، خلافاً لنسخة الشاشة المطابقة
  // (frontend/pos/receipt/[id]/page-client.tsx) التي تعرضها. مُصلَح هنا.
  const taxIdLines = [
    data.store.ifNumber ? `<p class="muted">IF: ${data.store.ifNumber}</p>` : '',
    data.store.ice ? `<p class="muted">ICE: ${data.store.ice}</p>` : '',
    data.store.rc ? `<p class="muted">RC: ${data.store.rc}</p>` : '',
    data.store.patente ? `<p class="muted">Patente: ${data.store.patente}</p>` : '',
  ].join('');

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 12px; }
  .header h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: start; }
  th { background: #f5f5f5; }
  .totals { width: 260px; margin-inline-start: auto; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #333; padding-top: 6px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${data.store.name}</h1>
      ${data.store.address ? `<p class="muted">${data.store.address}</p>` : ''}
      ${data.store.phone ? `<p class="muted">${data.store.phone}</p>` : ''}
    </div>
    <div style="text-align:end">
      <p style="font-size:16px;font-weight:bold">${l.invoiceNumberPrefix} ${data.invoiceNumber}</p>
      <p class="muted">${formatDate(data.createdAt, locale)}</p>
      <p class="muted">${data.customerName}</p>
      ${taxIdLines}
    </div>
  </div>

  <table>
    <thead><tr><th>${l.productCol}</th><th>${l.qtyCol}</th><th>${l.priceCol}</th><th>${l.totalCol}</th></tr></thead>
    <tbody>${data.items.map(itemRow).join('')}</tbody>
  </table>

  <div class="totals">
    <div><span>${l.subtotal}</span><span>${formatCurrency(data.subtotal, locale)}</span></div>
    <div><span>${l.discount}</span><span>${formatCurrency(data.discount, locale)}</span></div>
    <div><span>${l.tax} (${data.taxRate}%)</span><span>${formatCurrency(data.taxAmount, locale)}</span></div>
    <div class="grand"><span>${l.grandTotal}</span><span>${formatCurrency(data.total, locale)}</span></div>
    <div><span>${l.paid}</span><span>${formatCurrency(data.amountPaid, locale)}</span></div>
    <div><span>${l.changeDue}</span><span>${formatCurrency(data.changeDue, locale)}</span></div>
  </div>
</body>
</html>`;
}
