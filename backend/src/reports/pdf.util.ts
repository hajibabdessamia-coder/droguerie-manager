import { InternalServerErrorException, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';

const logger = new Logger('PdfUtil');

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], pipe: true });
  } catch (err) {
    logger.error('Puppeteer failed to launch (PDF generation)', err instanceof Error ? err.stack : err);
    throw new InternalServerErrorException('فشل توليد ملف PDF');
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
    throw new InternalServerErrorException('فشل توليد ملف PDF');
  } finally {
    await browser.close();
  }
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.م.`;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('ar-MA');
}

// دعم لغتين لقالب الفاتورة المطبوعة فقط (أكثر مستند يصل للزبون مباشرة) — راجع
// InvoiceLocale أدناه. بقية هذا الملف (buildSummaryReportHtml وتقارير Excel) لا يزال
// عربياً فقط: ترجمتها تتطلب آلية i18n عامة على مستوى الواجهة الخلفية بأكملها
// (رسائل الأخطاء، DTOs...)، وهذا نطاق أوسع من إصلاح قالب فاتورة واحد
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
  salesTotal: number;
  profitTotal: number;
  invoiceCount: number;
  purchasesValue: number;
  inventoryValue: number;
  topProducts: ProductStat[];
  leastProducts: ProductStat[];
}

export function buildSummaryReportHtml(report: SummaryReportData): string {
  const productRow = (p: ProductStat) =>
    `<tr><td>${p.name}</td><td>${p.qty}</td><td>${formatCurrency(p.revenue)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
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
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: right; }
  th { background: #f5f5f5; }
  h2 { font-size: 15px; margin: 16px 0 8px; }
</style>
</head>
<body>
  <h1>تقرير ${report.periodLabel}</h1>
  <p class="muted">من ${formatDate(report.start)} إلى ${formatDate(report.end)}</p>

  <div class="grid">
    <div class="card"><div class="label">إجمالي المبيعات</div><div class="value">${formatCurrency(report.salesTotal)}</div></div>
    <div class="card"><div class="label">الأرباح</div><div class="value">${formatCurrency(report.profitTotal)}</div></div>
    <div class="card"><div class="label">عدد الفواتير</div><div class="value">${report.invoiceCount}</div></div>
    <div class="card"><div class="label">قيمة المشتريات</div><div class="value">${formatCurrency(report.purchasesValue)}</div></div>
    <div class="card"><div class="label">قيمة المخزون</div><div class="value">${formatCurrency(report.inventoryValue)}</div></div>
  </div>

  <h2>أفضل المنتجات مبيعاً</h2>
  <table>
    <thead><tr><th>المنتج</th><th>الكمية المباعة</th><th>الإيراد</th></tr></thead>
    <tbody>${report.topProducts.map(productRow).join('') || '<tr><td colspan="3">لا توجد بيانات</td></tr>'}</tbody>
  </table>

  <h2>أقل المنتجات مبيعاً</h2>
  <table>
    <thead><tr><th>المنتج</th><th>الكمية المباعة</th><th>الإيراد</th></tr></thead>
    <tbody>${report.leastProducts.map(productRow).join('') || '<tr><td colspan="3">لا توجد بيانات</td></tr>'}</tbody>
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
    `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${formatCurrency(item.unitPrice)}</td><td>${formatCurrency(item.total)}</td></tr>`;

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
      <p class="muted">${formatDate(data.createdAt)}</p>
      <p class="muted">${data.customerName}</p>
      ${taxIdLines}
    </div>
  </div>

  <table>
    <thead><tr><th>${l.productCol}</th><th>${l.qtyCol}</th><th>${l.priceCol}</th><th>${l.totalCol}</th></tr></thead>
    <tbody>${data.items.map(itemRow).join('')}</tbody>
  </table>

  <div class="totals">
    <div><span>${l.subtotal}</span><span>${formatCurrency(data.subtotal)}</span></div>
    <div><span>${l.discount}</span><span>${formatCurrency(data.discount)}</span></div>
    <div><span>${l.tax} (${data.taxRate}%)</span><span>${formatCurrency(data.taxAmount)}</span></div>
    <div class="grand"><span>${l.grandTotal}</span><span>${formatCurrency(data.total)}</span></div>
    <div><span>${l.paid}</span><span>${formatCurrency(data.amountPaid)}</span></div>
    <div><span>${l.changeDue}</span><span>${formatCurrency(data.changeDue)}</span></div>
  </div>
</body>
</html>`;
}
