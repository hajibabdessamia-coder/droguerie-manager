import { exec } from 'child_process';
import * as fs from 'fs';
import { Controller, Get, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { Role } from '../common/enums';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { resolveLocale } from '../common/i18n/locale.util';
import { ReportQueryDto } from './dto/report-query.dto';
import { REPORTS_ROOT } from './reports-scheduler.service';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('summary')
  getSummary(@Query() query: ReportQueryDto, @Req() req: Request) {
    return this.service.getSummary(query.period, query.date, resolveLocale(req));
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
  async exportSummaryPdf(@Query() query: ReportQueryDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportSummaryPdf(query.period, query.date, resolveLocale(req));
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.service.exportSalesExcel(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      resolveLocale(req),
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="sales.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('export/products.xlsx')
  async exportProducts(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportProductsExcel(resolveLocale(req));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="products.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('export/customers.xlsx')
  async exportCustomers(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportCustomersExcel(resolveLocale(req));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="customers.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('export/suppliers.xlsx')
  async exportSuppliers(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportSuppliersExcel(resolveLocale(req));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="suppliers.xlsx"',
    });
    return new StreamableFile(buffer);
  }
}
