import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(userId: string, action: AuditAction, entityType: string, entityId?: string, details?: string) {
    return this.prisma.auditLog.create({
      data: { userId, action, entityType, entityId, details },
    });
  }
}
