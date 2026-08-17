import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export class ReportQueryDto {
  @IsIn(['daily', 'weekly', 'monthly', 'yearly'])
  period: ReportPeriod;

  @IsOptional()
  @IsDateString()
  date?: string;
}
