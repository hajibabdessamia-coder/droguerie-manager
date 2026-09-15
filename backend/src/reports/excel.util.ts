import { InternalServerErrorException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { SUMMARY_LABELS, type InvoiceLocale } from './pdf.util';

const logger = new Logger('ExcelUtil');

export async function buildExcelBuffer(
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  rows: Record<string, unknown>[],
  locale: InvoiceLocale = 'ar',
): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: locale === 'ar' }] });
    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (err) {
    logger.error('Excel generation failed', err instanceof Error ? err.stack : err);
    throw new InternalServerErrorException({ code: 'EXCEL_GENERATION_FAILED' });
  }
}

interface ProductStat {
  name: string;
  qty: number;
  revenue: number;
}

export interface SummaryReportRows {
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

export async function buildSummaryExcelBuffer(report: SummaryReportRows, locale: InvoiceLocale = 'ar'): Promise<Buffer> {
  const l = SUMMARY_LABELS[locale];
  const dateLocale = locale === 'ar' ? 'ar-MA' : 'fr-FR';
  const title = `${l.reportTitlePrefix} ${report.periodLabel}`;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title, { views: [{ rightToLeft: locale === 'ar' }] });
  sheet.columns = [{ width: 22 }, { width: 18 }, { width: 14 }];

  sheet.addRow([title]).font = { bold: true, size: 14 };
  sheet.addRow([
    `${l.fromLabel} ${report.start.toLocaleDateString(dateLocale)} ${l.toLabel} ${report.end.toLocaleDateString(dateLocale)}`,
  ]);
  sheet.addRow([]);

  const statRows: [string, number][] = [
    [l.totalSales, report.salesTotal],
    [l.profit, report.profitTotal],
    [l.invoiceCount, report.invoiceCount],
    [l.purchasesValue, report.purchasesValue],
    [l.inventoryValue, report.inventoryValue],
  ];
  for (const [label, value] of statRows) sheet.addRow([label, value]);
  sheet.addRow([]);

  sheet.addRow([l.topProducts]).font = { bold: true };
  sheet.addRow([l.productCol, l.qtySoldCol, l.revenueCol]).font = { bold: true };
  report.topProducts.forEach((p) => sheet.addRow([p.name, p.qty, p.revenue]));
  sheet.addRow([]);

  sheet.addRow([l.leastProducts]).font = { bold: true };
  sheet.addRow([l.productCol, l.qtySoldCol, l.revenueCol]).font = { bold: true };
  report.leastProducts.forEach((p) => sheet.addRow([p.name, p.qty, p.revenue]));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
