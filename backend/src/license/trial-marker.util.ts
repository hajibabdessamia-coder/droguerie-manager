import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// علامة احتياطية زمنية خارج مجلد userData الرئيسي (حيث تعيش قاعدة بيانات SQLite) —
// الهدف هو أن حذف/استبدال قاعدة البيانات وحدها (لإعادة تشغيل الفترة التجريبية) لا
// يكفي وحده، لأن هذه العلامة تبقى وتُستخدم كحدّ أدنى (تاريخ البداية الفعلي هو الأقدم
// بين الاثنين). هذا احتكاك إضافي وليس ضماناً — راجع التوثيق في license.service.ts
// حول الحدود الواقعية لهذه الحماية في تطبيق يعمل بلا اتصال بالكامل
function markerDir(): string {
  const base = process.env.LOCALAPPDATA || os.tmpdir();
  return path.join(base, '.pmts');
}

function markerPath(): string {
  return path.join(markerDir(), 'marker.json');
}

interface MarkerFile {
  trialStartedAt: string;
  mac: string;
}

function computeMac(deviceId: string, trialStartedAt: string): string {
  return crypto.createHmac('sha256', deviceId).update(trialStartedAt).digest('hex');
}

export interface TrialMarkerResult {
  effectiveTrialStartedAt: Date;
  tampered: boolean;
}

// تُستدعى عند كل فحص لحالة الترخيص. تنشئ العلامة عند أول استدعاء إن لم تكن موجودة،
// وإلا تقارنها بتاريخ بداية الفترة التجريبية المخزَّن في قاعدة البيانات وتُرجع الأقدم
export function readOrInitTrialMarker(deviceId: string, dbTrialStartedAt: Date): TrialMarkerResult {
  const dir = markerDir();
  const file = markerPath();

  let existing: MarkerFile | null = null;
  let tampered = false;
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as MarkerFile;
      if (parsed && typeof parsed.trialStartedAt === 'string' && typeof parsed.mac === 'string') {
        if (computeMac(deviceId, parsed.trialStartedAt) === parsed.mac) {
          existing = parsed;
        } else {
          // العلامة موجودة لكن مُعدَّلة يدوياً (mac لا يطابق) — لا يمكن الوثوق بقيمتها،
          // لكن وجود تلاعب بها بحد ذاته مؤشر يستحق التسجيل
          tampered = true;
        }
      }
    } catch {
      tampered = true;
    }
  }

  const existingDate = existing ? new Date(existing.trialStartedAt) : null;
  const effective = existingDate && existingDate.getTime() < dbTrialStartedAt.getTime() ? existingDate : dbTrialStartedAt;

  // أعد كتابة العلامة دائماً بأقدم قيمة معروفة (لا تتأخر أبداً للأمام) — تُنشأ من
  // العدم في أول تشغيل على الإطلاق، وتبقى ثابتة بعد ذلك طالما لم تُحذف يدوياً
  try {
    fs.mkdirSync(dir, { recursive: true });
    const iso = effective.toISOString();
    fs.writeFileSync(file, JSON.stringify({ trialStartedAt: iso, mac: computeMac(deviceId, iso) } satisfies MarkerFile));
  } catch {
    // فشل كتابة العلامة (صلاحيات، قرص ممتلئ...) ليس سبباً كافياً لمنع التطبيق من
    // العمل — قاعدة البيانات تبقى المصدر الأساسي، هذه فقط طبقة حماية إضافية
  }

  return { effectiveTrialStartedAt: effective, tampered };
}
