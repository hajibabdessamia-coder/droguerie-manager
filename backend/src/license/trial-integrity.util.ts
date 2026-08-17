import * as crypto from 'crypto';

// HMAC على الحقول الجوهرية لصف AppLicense، بمفتاح مشتق من معرّف الجهاز — يكشف تعديلاً
// مباشراً على قاعدة البيانات عبر أداة تصفح SQLite (مثال: تعديل trialStartedAt يدوياً
// لإطالة الفترة التجريبية). هذا ليس بديلاً عن توقيع الترخيص نفسه: أي شخص يملك قراءة
// الشيفرة المصدرية لهذا الملف يمكنه نظرياً حساب HMAC صحيح لقيم جديدة أيضاً — فائدته
// الفعلية هي رفع تكلفة التلاعب العرضي/السطحي، وليس منع خصم متمرّس يفهم الشيفرة
export function computeIntegrityHash(
  deviceId: string,
  fields: { trialStartedAt: Date; licenseKey: string | null; activatedAt: Date | null },
): string {
  const canonical = [
    fields.trialStartedAt.toISOString(),
    fields.licenseKey ?? '',
    fields.activatedAt ? fields.activatedAt.toISOString() : '',
  ].join('|');
  return crypto.createHmac('sha256', deviceId).update(canonical).digest('hex');
}
