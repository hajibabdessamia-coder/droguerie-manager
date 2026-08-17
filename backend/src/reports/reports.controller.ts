import { exec } from 'child_process';
import * as fs from 'fs';
import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { Role } from '../common/enums';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { REPORTS_ROOT } from './reports-scheduler.service';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('summary')
  getSummary(@Query() query: ReportQueryDto) {
    return this.service.getSummary(query.period, query.date);
  }

  // يفتح مجلد التقارير في مستكشف الملفات — لا معنى لهذا على خادم سحابي بدون واجهة رسومية (Render/Linux)
  @Roles(Role.ADMIN)
  @Get('open-folder')
  openFolder() {
    fs.mkdirSync(REPORTS_ROOT, { recursive: true });
    const opened = process.platform === 'win32';
    if (opened) exec(`explorer.exe "${REPORTS_ROOT}"`);
    return { ok: true, path: REPORTS_ROOT, opened };
  }

  @Get('export/summary.pdf')
  async exportSummaryPdf(@Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportSummaryPdf(query.period, query.date);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${query.period}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('export/sales.xlsx')
  async exportSales(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.service.exportSalesExcel(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="sales.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('export/products.xlsx')
  async exportProducts(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportProductsExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="products.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('export/customers.xlsx')
  async exportCustomers(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportCustomersExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="customers.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('export/suppliers.xlsx')
  async exportSuppliers(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportSuppliersExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="suppliers.xlsx"',
    });
    return new StreamableFile(buffer);
  }
}
