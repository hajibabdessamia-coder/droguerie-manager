import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportPeriod } from './dto/report-query.dto';
import { buildSummaryExcelBuffer } from './excel.util';
import { buildSummaryReportHtml, renderPdfFromHtml } from './pdf.util';
import { ReportsService } from './reports.service';

const PERIOD_FOLDER: Record<ReportPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

// المسار محلي بجانب مجلد backend، وليس داخل dist، حتى يبقى المجلد ثابتاً بين عمليات إعادة البناء
export const REPORTS_ROOT = path.join(process.cwd(), 'Reports');

@Injectable()
export class ReportsSchedulerService {
  private readonly logger = new Logger(ReportsSchedulerService.name);

  constructor(private reportsService: ReportsService) {}

  @Cron('0 5 0 * * *') // يومياً 00:05
  handleDaily() {
    return this.generateAndSave('daily');
  }

  @Cron('0 10 0 * * 1') // كل اثنين 00:10
  handleWeekly() {
    return this.generateAndSave('weekly');
  }

  @Cron('0 15 0 1 * *') // أول كل شهر 00:15
  handleMonthly() {
    return this.generateAndSave('monthly');
  }

  @Cron('0 20 0 1 1 *') // 1 يناير 00:20
  handleYearly() {
    return this.generateAndSave('yearly');
  }

  private async generateAndSave(period: ReportPeriod) {
    try {
      const report = await this.reportsService.getSummary(period);
      const folder = path.join(REPORTS_ROOT, PERIOD_FOLDER[period]);
      fs.mkdirSync(folder, { recursive: true });

      const dateStamp = new Date().toISOString().slice(0, 10);
      const baseName = `report-${dateStamp}`;

      const excelBuffer = await buildSummaryExcelBuffer(report);
      fs.writeFileSync(path.join(folder, `${baseName}.xlsx`), excelBuffer);

      const html = buildSummaryReportHtml(report);
      const pdfBuffer = await renderPdfFromHtml(html);
      fs.writeFileSync(path.join(folder, `${baseName}.pdf`), pdfBuffer);

      this.logger.log(`تم توليد تقرير ${period} تلقائياً في ${folder}`);
    } catch (error) {
      this.logger.error(`فشل توليد تقرير ${period} تلقائياً`, error instanceof Error ? error.stack : undefined);
    }
  }
}
