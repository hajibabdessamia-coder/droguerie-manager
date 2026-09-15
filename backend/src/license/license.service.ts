import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatDeviceIdForDisplay, getDeviceId } from './device-id.util';
import { verifyLicenseKey } from './license-crypto.util';
import { computeIntegrityHash } from './trial-integrity.util';
import { readOrInitTrialMarker } from './trial-marker.util';

export const TRIAL_DAYS = 7;
// يمتص انحرافاً صغيراً في الساعة (تغيير منطقة زمنية، توقيت صيفي/شتوي، مزامنة NTP
// عادية) دون معاملته كتلاعب فعلي بالساعة لإطالة الفترة التجريبية
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type LicenseState = 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'LICENSED' | 'LICENSE_EXPIRED' | 'LICENSE_INVALID';

export interface LicenseStatus {
  state: LicenseState;
  remainingDays?: number;
  deviceId: string;
  clockAnomalyDetected: boolean;
}

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  constructor(private prisma: PrismaService) {}

  private resolveDeviceId(): string {
    try {
      return getDeviceId();
    } catch (err) {
      this.logger.error('تعذّر تحديد هوية الجهاز', err instanceof Error ? err.stack : err);
      throw new InternalServerErrorException({ code: 'LICENSE_DEVICE_ID_FAILED' });
    }
  }

  private async getOrCreateRow(deviceId: string) {
    const existing = await this.prisma.appLicense.findFirst();
    if (existing) return existing;

    const now = new Date();
    const integrityHash = computeIntegrityHash(deviceId, { trialStartedAt: now, licenseKey: null, activatedAt: null });
    return this.prisma.appLicense.create({
      data: { trialStartedAt: now, trialHighWaterMark: now, integrityHash },
    });
  }

  async getStatus(): Promise<LicenseStatus> {
    const deviceId = this.resolveDeviceId();
    // المعرّف القانوني لربط الترخيص هو بالضبط القيمة المختصرة المعروضة للعميل على شاشة
    // التفعيل — وليس هاش الجهاز الخام الداخلي — لأنها القيمة الوحيدة التي يراها العميل
    // وينسخها للبائع؛ ترخيص مُوقَّع بأي قيمة غير هذه لن يُطابق أبداً (كان هذا هو سبب
    // فشل كل تفعيل حقيقي). سلامة الفترة التجريبية (integrityHash/marker أدناه) تبقى
    // مربوطة بالهاش الخام كما كانت — لم يتغيّر إلا ربط الترخيص نفسه
    const licenseDeviceId = formatDeviceIdForDisplay(deviceId);
    const row = await this.getOrCreateRow(deviceId);

    // فحص سلامة الصف: تعديل مباشر عبر أداة تصفح SQLite (مثال: تغيير trialStartedAt
    // يدوياً) يُفسد تطابق HMAC — راجع trial-integrity.util.ts للحدود الواقعية لهذا الفحص
    const expectedHash = computeIntegrityHash(deviceId, {
      trialStartedAt: row.trialStartedAt,
      licenseKey: row.licenseKey,
      activatedAt: row.activatedAt,
    });
    const dbTampered = expectedHash !== row.integrityHash;

    // علامة احتياطية خارج قاعدة البيانات: تمنع "احذف قاعدة البيانات لبدء فترة تجريبية
    // جديدة" من إعادة العدّاد فعلياً
    const marker = readOrInitTrialMarker(deviceId, row.trialStartedAt);
    const effectiveTrialStartedAt =
      marker.effectiveTrialStartedAt.getTime() < row.trialStartedAt.getTime() ? marker.effectiveTrialStartedAt : row.trialStartedAt;

    // مرساة الساعة أحادية الاتجاه: إن كانت الساعة الحالية متأخرة عن آخر نقطة مسجَّلة
    // بأكثر من هامش التسامح، فهذا إرجاع للساعة — يُستخدم آخر وقت معروف بدل الوقت الحالي
    const now = new Date();
    let clockAnomalyDetected = row.clockAnomalyDetected || marker.tampered || dbTampered;
    let effectiveNow = now;
    if (now.getTime() < row.trialHighWaterMark.getTime() - CLOCK_TOLERANCE_MS) {
      clockAnomalyDetected = true;
      effectiveNow = row.trialHighWaterMark;
    } else if (now.getTime() > row.trialHighWaterMark.getTime()) {
      effectiveNow = now;
    } else {
      effectiveNow = row.trialHighWaterMark;
    }

    // كتابة عبر (write-through) عند كل فحص: تُقدَّم المرساة للأمام فقط، ويُصحَّح تاريخ
    // البداية إن كانت العلامة الاحتياطية تحمل تاريخاً أقدم، وتُعاد حساب HMAC للصف الجديد
    const updatedFields = {
      trialStartedAt: effectiveTrialStartedAt,
      trialHighWaterMark: effectiveNow,
      clockAnomalyDetected,
    };
    const newIntegrityHash = computeIntegrityHash(deviceId, {
      trialStartedAt: updatedFields.trialStartedAt,
      licenseKey: row.licenseKey,
      activatedAt: row.activatedAt,
    });
    await this.prisma.appLicense.update({
      where: { id: row.id },
      data: { ...updatedFields, integrityHash: newIntegrityHash },
    });

    if (row.licenseKey) {
      const result = verifyLicenseKey(row.licenseKey, licenseDeviceId);
      if (result.ok) {
        return { state: 'LICENSED', deviceId: licenseDeviceId, clockAnomalyDetected };
      }
      // ترخيص مخزَّن لكن غير صالح: إمّا انتهت صلاحيته، أو تالف/تعديل، أو (الأخطر) صف
      // قاعدة بيانات مُنسوخ من جهاز آخر يحمل ترخيصاً لا يخص هذا الجهاز — في كل الحالات
      // لا يُسمح بالرجوع لحالة "فترة تجريبية جديدة"، بل يُحجب التطبيق صراحة
      return {
        state: result.reason === 'EXPIRED' ? 'LICENSE_EXPIRED' : 'LICENSE_INVALID',
        deviceId: licenseDeviceId,
        clockAnomalyDetected,
      };
    }

    const remainingMs = effectiveTrialStartedAt.getTime() + TRIAL_DAYS * DAY_MS - effectiveNow.getTime();
    const expired = remainingMs <= 0;
    return {
      state: expired ? 'TRIAL_EXPIRED' : 'TRIAL_ACTIVE',
      remainingDays: expired ? 0 : Math.max(0, Math.ceil(remainingMs / DAY_MS)),
      deviceId: licenseDeviceId,
      clockAnomalyDetected,
    };
  }

  async activate(rawLicenseKey: string): Promise<LicenseStatus> {
    const deviceId = this.resolveDeviceId();
    const licenseDeviceId = formatDeviceIdForDisplay(deviceId);
    const result = verifyLicenseKey(rawLicenseKey, licenseDeviceId);
    if (!result.ok) {
      throw new BadRequestException({ code: result.reason });
    }

    const row = await this.getOrCreateRow(deviceId);
    const activatedAt = new Date();
    const integrityHash = computeIntegrityHash(deviceId, {
      trialStartedAt: row.trialStartedAt,
      licenseKey: rawLicenseKey,
      activatedAt,
    });
    await this.prisma.appLicense.update({
      where: { id: row.id },
      data: { licenseKey: rawLicenseKey, activatedAt, integrityHash },
    });

    return this.getStatus();
  }
}
