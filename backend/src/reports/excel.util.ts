import { InternalServerErrorException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

const logger = new Logger('ExcelUtil');

export async function buildExcelBuffer(
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });
    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (err) {
    logger.error('Excel generation failed', err instanceof Error ? err.stack : err);
    throw new InternalServerErrorException('فشل توليد ملف Excel');
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

export async function buildSummaryExcelBuffer(report: SummaryReportRows): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`تقرير ${report.periodLabel}`, { views: [{ rightToLeft: true }] });
  sheet.columns = [{ width: 22 }, { width: 18 }, { width: 14 }];

  sheet.addRow([`تقرير ${report.periodLabel}`]).font = { bold: true, size: 14 };
  sheet.addRow([`من ${report.start.toLocaleDateString('ar-MA')} إلى ${report.end.toLocaleDateString('ar-MA')}`]);
  sheet.addRow([]);

  const statRows: [string, number][] = [
    ['إجمالي المبيعات', report.salesTotal],
    ['الأرباح', report.profitTotal],
    ['عدد الفواتير', report.invoiceCount],
    ['قيمة المشتريات', report.purchasesValue],
    ['قيمة المخزون', report.inventoryValue],
  ];
  for (const [label, value] of statRows) sheet.addRow([label, value]);
  sheet.addRow([]);

  sheet.addRow(['أفضل المنتجات مبيعاً']).font = { bold: true };
  sheet.addRow(['المنتج', 'الكمية المباعة', 'الإيراد']).font = { bold: true };
  report.topProducts.forEach((p) => sheet.addRow([p.name, p.qty, p.revenue]));
  sheet.addRow([]);

  sheet.addRow(['أقل المنتجات مبيعاً']).font = { bold: true };
  sheet.addRow(['المنتج', 'الكمية المباعة', 'الإيراد']).font = { bold: true };
  report.leastProducts.forEach((p) => sheet.addRow([p.name, p.qty, p.revenue]));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
