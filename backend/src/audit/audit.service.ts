import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // client اختياري: يمرَّر tx عند الاستدعاء من داخل $transaction نشطة، لتجنّب الكتابة عبر
  // اتصال منفصل بينما SQLite لا يزال يحمل قفل الكتابة الخاص بالمعاملة الأصلية (P2028)
  log(
    userId: string,
    action: AuditAction,
    entityType: string,
    entityId?: string,
    details?: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    return client.auditLog.create({
      data: { userId, action, entityType, entityId, details },
    });
  }
}
