import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsSchedulerService } from './reports-scheduler.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsSchedulerService],
})
export class ReportsModule {}
