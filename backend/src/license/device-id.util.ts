import { execSync } from 'child_process';
import * as crypto from 'crypto';

// يُشتق معرّف الجهاز من MachineGuid المخزَّن في سجل Windows (سطر واحد ثابت لكل تثبيت
// Windows، لا يتغيّر بين عمليات إعادة التشغيل أو إعادة تسمية الجهاز) — نفس الأسلوب
// الذي تعتمده حزمة node-machine-id الشائعة على Windows، لكن دون إضافة أي تبعية جديدة:
// "reg query" أداة نظام متوفرة دائماً، بنفس أسلوب استدعاء أوامر النظام المُستخدَم
// فعلياً في make-dev-cert.ps1 وreports.controller.ts (فتح مجلد التقارير عبر explorer.exe)
const MACHINE_GUID_PATTERN = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/;

// ثابت تطبيقي (وليس سرّاً) يُضاف إلى MachineGuid قبل التجزئة، فقط لتفادي تصادم نظري
// مع أي استخدام آخر لنفس القيمة الخام — لا يُغيّر الخاصية الأمنية الفعلية للمعرّف
const APP_SALT = 'pharma-manager-device-id-v1';

function readWindowsMachineGuid(): string {
  let output: string;
  try {
    output = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid').toString();
  } catch (err) {
    throw new Error('تعذّر تحديد هوية الجهاز (فشل الاستعلام عن سجل Windows)');
  }
  const match = output.match(MACHINE_GUID_PATTERN);
  if (!match) {
    throw new Error('تعذّر تحديد هوية الجهاز (لم يُعثر على MachineGuid)');
  }
  return match[1];
}

// معرّف الجهاز الخام (كامل، مستقر، غير قابل للعرض بسهولة) — هذا هو ما يُوقَّع فعلياً
// داخل الترخيص، وليس النسخة المختصرة المعروضة للمستخدم
export function getDeviceId(): string {
  const machineGuid = readWindowsMachineGuid();
  return crypto.createHash('sha256').update(`${machineGuid}:${APP_SALT}`).digest('hex').slice(0, 32);
}

// نسخة مختصرة (16 حرفاً سداسياً عشرياً، 4 مجموعات من 4) لعرضها للمستخدم ونسخها/مشاركتها
// مع البائع هاتفياً أو عبر رسالة نصية — لا تُستخدم في التحقق من التوقيع، فقط للعرض
export function formatDeviceIdForDisplay(deviceId: string): string {
  const short = deviceId.slice(0, 16).toUpperCase();
  return short.match(/.{1,4}/g)!.join('-');
}
