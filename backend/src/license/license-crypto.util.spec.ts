import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// يُضبَط قبل أي import لـ verifyLicenseKey لأن loadPublicKey() في الملف المُختبَر
// يقرأ process.env.LICENSE_PUBLIC_KEY_PATH بشكل كسول (عند أول استدعاء فعلي فقط،
// وليس عند التحميل) ثم يخزّن النتيجة مؤقتاً — ضبطه هنا قبل أي استدعاء كافٍ تماماً
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const testPublicKeyPath = path.join(os.tmpdir(), `license-test-public-${Date.now()}.pem`);
fs.writeFileSync(testPublicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
process.env.LICENSE_PUBLIC_KEY_PATH = testPublicKeyPath;

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { findRepoRoot, verifyLicenseKey } from './license-crypto.util';

function makeLicenseKey(payload: { deviceId: string; issuedAt: string; expiresAt: string | null }, signWith = privateKey) {
  const payloadJson = JSON.stringify(payload);
  const signature = crypto.sign(null, Buffer.from(payloadJson, 'utf-8'), signWith);
  return Buffer.from(JSON.stringify({ payload, signature: signature.toString('base64') }), 'utf-8').toString('base64url');
}

const DEVICE_ID = 'device-abc-123';

describe('verifyLicenseKey', () => {
  afterAll(() => {
    fs.rmSync(testPublicKeyPath, { force: true });
  });

  it('accepts a validly signed, matching-device, unexpired license', () => {
    const key = makeLicenseKey({ deviceId: DEVICE_ID, issuedAt: new Date().toISOString(), expiresAt: null });
    const result = verifyLicenseKey(key, DEVICE_ID);
    expect(result.ok).toBe(true);
  });

  it('rejects a license signed with a different (attacker) private key', () => {
    const { privateKey: otherPrivateKey } = crypto.generateKeyPairSync('ed25519');
    const key = makeLicenseKey({ deviceId: DEVICE_ID, issuedAt: new Date().toISOString(), expiresAt: null }, otherPrivateKey);
    const result = verifyLicenseKey(key, DEVICE_ID);
    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('rejects a validly signed license issued for a different device', () => {
    const key = makeLicenseKey({ deviceId: 'some-other-device', issuedAt: new Date().toISOString(), expiresAt: null });
    const result = verifyLicenseKey(key, DEVICE_ID);
    expect(result).toEqual({ ok: false, reason: 'WRONG_DEVICE' });
  });

  it('rejects a validly signed, correct-device license that has expired', () => {
    const key = makeLicenseKey({
      deviceId: DEVICE_ID,
      issuedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const result = verifyLicenseKey(key, DEVICE_ID);
    expect(result).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('rejects a malformed / non-base64url / corrupted key string', () => {
    const result = verifyLicenseKey('not-a-real-license-key!!', DEVICE_ID);
    expect(result.ok).toBe(false);
  });

  it('rejects a payload tampered post-signature (e.g. attacker strips the expiry to forge a perpetual license)', () => {
    const expiring = makeLicenseKey({
      deviceId: DEVICE_ID,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const decoded = JSON.parse(Buffer.from(expiring, 'base64url').toString('utf-8'));
    decoded.payload.expiresAt = null;
    const forged = Buffer.from(JSON.stringify(decoded), 'utf-8').toString('base64url');
    const result = verifyLicenseKey(forged, DEVICE_ID);
    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });
});

describe('findRepoRoot', () => {
  // هذا الملف نفسه يعيش دائماً في backend/src/license/، بصرف النظر عن نمط التشغيل
  // (ts-jest يشغّله من المصدر مباشرة) — لذا فإن الصعود 3 مستويات من هنا هو مرجع
  // معروف وصحيح لجذر المستودع، يُستخدم للمقارنة في الاختبارين أدناه
  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  it('resolves the repo root from the ts-node/source directory layout (backend/src/license)', () => {
    expect(findRepoRoot(path.join(repoRoot, 'backend', 'src', 'license'))).toBe(repoRoot);
  });

  it('resolves the repo root from the compiled dist/src directory layout (backend/dist/src/license) — this is the exact layout that previously broke with a fixed "../../.." count', () => {
    expect(findRepoRoot(path.join(repoRoot, 'backend', 'dist', 'src', 'license'))).toBe(repoRoot);
  });

  it('throws a clear error instead of silently resolving to the wrong place when no repo root can be found', () => {
    expect(() => findRepoRoot(path.parse(repoRoot).root)).toThrow();
  });
});
