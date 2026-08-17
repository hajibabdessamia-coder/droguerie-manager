import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('LicenseCrypto');

export interface LicensePayload {
  deviceId: string;
  issuedAt: string;
  expiresAt: string | null;
}

export type LicenseVerificationResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: 'MALFORMED' | 'INVALID_SIGNATURE' | 'WRONG_DEVICE' | 'EXPIRED' };

// يصعد من startDir أباً بعد أب حتى يجد المجلد الذي يحوي كلاً من backend/ وelectron/
// كمجلدين فرعيين مباشرين — أي جذر المستودع نفسه. هذا يعمل بشكل صحيح بصرف النظر عن
// عمق __dirname الفعلي وقت التشغيل، والذي يختلف فعلياً بين تخطيطين مختلفين لهذا
// المشروع تحديداً: backend/src/license (تشغيل مباشر عبر ts-node/jest) مقابل
// backend/dist/src/license (بعد nest build — مستوى إضافي بسبب rootDir الموسَّع الناتج
// عن ملف scratch-test-report-gen.ts، وهي مشكلة موثَّقة مسبقاً في HANDOFF.md). الاعتماد
// على عدد ثابت من ".." كان يفترض ضمنياً عمقاً واحداً فقط، فيفشل في أحد التخطيطين —
// هذا الصعود الديناميكي يعمل في كليهما دون افتراض أي عمق مسبقاً
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'backend')) && fs.existsSync(path.join(dir, 'electron'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // بلغنا جذر نظام الملفات دون إيجاد المستودع
    dir = parent;
  }
  throw new Error('تعذّر تحديد مسار جذر المشروع لإيجاد المفتاح العلني');
}

// المفتاح العلني فقط يُحمَّل هنا — لا يوجد مسار في هذا الملف أو في أي ملف آخر داخل
// backend/ أو electron/ يقرأ مفتاحاً خاصاً؛ التوقيع يحدث فقط في license-tool/
// (خارج التطبيق تماماً، راجع license-tool/generate-license.js)
function resolvePublicKeyPath(): string {
  const fromEnv = process.env.LICENSE_PUBLIC_KEY_PATH;
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  // احتياطي وقت التطوير فقط إن لم يُمرَّر المتغيّر (مثال: تشغيل الاختبارات مباشرة) —
  // في النسخة المُعبّأة، electron/main.js يمرّر LICENSE_PUBLIC_KEY_PATH دائماً صراحة
  return path.join(findRepoRoot(__dirname), 'electron', 'resources', 'license-public-key.pem');
}

let cachedPublicKey: crypto.KeyObject | null = null;

function loadPublicKey(): crypto.KeyObject {
  if (cachedPublicKey) return cachedPublicKey;
  const keyPath = resolvePublicKeyPath();
  const pem = fs.readFileSync(keyPath, 'utf-8');
  cachedPublicKey = crypto.createPublicKey(pem);
  return cachedPublicKey;
}

// يتحقق من توقيع مفتاح الترخيص فقط (Ed25519) — لا يتحقق من الجهاز أو الانتهاء، ذلك
// مسؤولية verifyLicenseKey أدناه، حتى يمكن تمييز سبب الرفض بدقة للمستخدم
function verifySignature(payloadJson: string, signatureBase64: string): boolean {
  try {
    const publicKey = loadPublicKey();
    return crypto.verify(null, Buffer.from(payloadJson, 'utf-8'), publicKey, Buffer.from(signatureBase64, 'base64'));
  } catch (err) {
    logger.error('فشل التحقق من توقيع الترخيص', err instanceof Error ? err.stack : err);
    return false;
  }
}

// يفكّ ترميز نص الترخيص (base64url لِـ JSON { payload, signature }) ويتحقق من التوقيع
// ثم من مطابقة الجهاز وصلاحية تاريخ الانتهاء — بهذا الترتيب بالضبط، حتى لا يُكشَف أي
// تفصيل عن سبب الرفض قبل التأكد أولاً من أن التوقيع نفسه صحيح
export function verifyLicenseKey(rawKey: string, currentDeviceId: string): LicenseVerificationResult {
  let parsed: { payload: LicensePayload; signature: string };
  try {
    const json = Buffer.from(rawKey, 'base64url').toString('utf-8');
    parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.payload || !parsed.signature) {
      return { ok: false, reason: 'MALFORMED' };
    }
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }

  const payloadJson = JSON.stringify(parsed.payload);
  if (!verifySignature(payloadJson, parsed.signature)) {
    return { ok: false, reason: 'INVALID_SIGNATURE' };
  }

  if (parsed.payload.deviceId !== currentDeviceId) {
    return { ok: false, reason: 'WRONG_DEVICE' };
  }

  if (parsed.payload.expiresAt && new Date(parsed.payload.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'EXPIRED' };
  }

  return { ok: true, payload: parsed.payload };
}
