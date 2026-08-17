import { ReportPeriod } from './dto/report-query.dto';

export function getPeriodRange(period: ReportPeriod, dateStr?: string): { start: Date; end: Date } {
  const date = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  let end: Date;

  switch (period) {
    case 'weekly': {
      const dayOfWeek = start.getDay(); // 0 = Sunday
      const diffToMonday = (dayOfWeek + 6) % 7;
      start.setDate(start.getDate() - diffToMonday);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
    }
    case 'monthly':
      start.setDate(1);
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      break;
    case 'yearly':
      start.setMonth(0, 1);
      end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      break;
    case 'daily':
    default:
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;
  }

  return { start, end };
}

export const PERIOD_LABEL: Record<ReportPeriod, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
  yearly: 'سنوي',
};
