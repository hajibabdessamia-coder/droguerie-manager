import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BackupStatus } from '../common/enums';

// نفس نمط REPORTS_ROOT في reports-scheduler.service.ts: process.cwd() هو مجلد
// بيانات المستخدم (userData) لأن electron/main.js يشغّل الخادم الخلفي بهذا المجلد
// كـ cwd — يعمل بدون أي تعديل هنا سواء داخل Electron أو في وضع التطوير المحلي
export const BACKUPS_ROOT = path.join(process.cwd(), 'Backups');

// اسم الملف الذي يتحقق منه electron/main.js عند بدء التشغيل التالي لتطبيق
// الاستعادة — لا يمكن استبدال قاعدة البيانات الحية أثناء اتصال Prisma بها
const RESTORE_MARKER = path.join(process.cwd(), 'restore-pending.db');

@Injectable()
export class BackupService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.backup.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create() {
    fs.mkdirSync(BACKUPS_ROOT, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(BACKUPS_ROOT, `backup-${stamp}.db`);

    try {
      // VACUUM INTO يكتب لقطة متسقة كاملة من قاعدة البيانات إلى ملف جديد بأمان
      // أثناء استخدام قاعدة البيانات فعلياً — أفضل من نسخ الملف مباشرة (fs.copyFile)
      // الذي قد يلتقط حالة غير متسقة أثناء كتابة متزامنة
      await this.prisma.$executeRawUnsafe('VACUUM INTO ?', filePath);
      const { size } = fs.statSync(filePath);
      return this.prisma.backup.create({
        data: { filePath, sizeBytes: size, status: BackupStatus.SUCCESS },
      });
    } catch (error) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await this.prisma.backup.create({
        data: { filePath, sizeBytes: null, status: BackupStatus.FAILED },
      });
      throw error;
    }
  }

  async remove(id: string) {
    const backup = await this.prisma.backup.findUnique({ where: { id } });
    if (!backup) throw new NotFoundException({ code: 'BACKUP_NOT_FOUND' });
    if (fs.existsSync(backup.filePath)) fs.unlinkSync(backup.filePath);
    await this.prisma.backup.delete({ where: { id } });
    return { ok: true };
  }

  async restore(id: string) {
    const backup = await this.prisma.backup.findUnique({ where: { id } });
    if (!backup) throw new NotFoundException({ code: 'BACKUP_NOT_FOUND' });
    if (!fs.existsSync(backup.filePath)) {
      throw new NotFoundException({ code: 'BACKUP_FILE_MISSING' });
    }

    fs.copyFileSync(backup.filePath, RESTORE_MARKER);

    // تأخير قصير يترك وقتاً كافياً لاستجابة HTTP هذه لتصل إلى الواجهة قبل أن
    // تُعيد Electron تشغيل التطبيق بالكامل (راجع electron/main.js: الاستماع
    // لرسالة 'restore-requested' عبر قناة fork() الداخلية بين العمليتين)
    setTimeout(() => {
      if (typeof process.send === 'function') {
        process.send({ type: 'restore-requested' });
      }
    }, 1200);

    return { ok: true, requiresRestart: true };
  }

  openFolder() {
    fs.mkdirSync(BACKUPS_ROOT, { recursive: true });
    const opened = process.platform === 'win32';
    if (opened) exec(`explorer.exe "${BACKUPS_ROOT}"`);
    return { ok: true, path: BACKUPS_ROOT, opened };
  }
}
