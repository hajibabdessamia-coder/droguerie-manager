import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const testPublicKeyPath = path.join(os.tmpdir(), `license-service-test-public-${Date.now()}.pem`);
fs.writeFileSync(testPublicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
process.env.LICENSE_PUBLIC_KEY_PATH = testPublicKeyPath;

jest.mock('./device-id.util');
jest.mock('./trial-marker.util');

import { LicenseService } from './license.service';
import { computeIntegrityHash } from './trial-integrity.util';
import * as deviceIdUtil from './device-id.util';
import * as trialMarkerUtil from './trial-marker.util';

const DEVICE_ID = 'device-under-test';
const DAY_MS = 24 * 60 * 60 * 1000;

function makeLicenseKey(overrides: Partial<{ deviceId: string; issuedAt: string; expiresAt: string | null }> = {}) {
  const payload = { deviceId: DEVICE_ID, issuedAt: new Date().toISOString(), expiresAt: null, ...overrides };
  const signature = crypto.sign(null, Buffer.from(JSON.stringify(payload), 'utf-8'), privateKey);
  return Buffer.from(JSON.stringify({ payload, signature: signature.toString('base64') }), 'utf-8').toString('base64url');
}

function buildRow(overrides: Partial<{
  id: string;
  trialStartedAt: Date;
  trialHighWaterMark: Date;
  clockAnomalyDetected: boolean;
  licenseKey: string | null;
  activatedAt: Date | null;
}> = {}) {
  const base = {
    id: 'license-row-1',
    trialStartedAt: new Date(),
    trialHighWaterMark: new Date(),
    clockAnomalyDetected: false,
    licenseKey: null as string | null,
    activatedAt: null as Date | null,
  };
  const row = { ...base, ...overrides };
  const integrityHash = computeIntegrityHash(DEVICE_ID, {
    trialStartedAt: row.trialStartedAt,
    licenseKey: row.licenseKey,
    activatedAt: row.activatedAt,
  });
  return { ...row, integrityHash, createdAt: row.trialStartedAt, updatedAt: row.trialStartedAt };
}

function buildService(initialRow: ReturnType<typeof buildRow> | null) {
  const store = { row: initialRow };
  const prisma = {
    appLicense: {
      findFirst: jest.fn().mockImplementation(async () => store.row),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        store.row = { id: 'license-row-1', createdAt: new Date(), updatedAt: new Date(), ...data } as ReturnType<
          typeof buildRow
        >;
        return store.row;
      }),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        store.row = { ...store.row, ...data } as ReturnType<typeof buildRow>;
        return store.row;
      }),
    },
  };
  const service = new LicenseService(prisma as never);
  return { service, prisma, store };
}

describe('LicenseService', () => {
  beforeEach(() => {
    (deviceIdUtil.getDeviceId as jest.Mock).mockReturnValue(DEVICE_ID);
    (deviceIdUtil.formatDeviceIdForDisplay as jest.Mock).mockImplementation((id: string) => id.toUpperCase());
    // بلا مؤثرات إضافية افتراضياً: العلامة الاحتياطية "توافق" قاعدة البيانات دائماً
    (trialMarkerUtil.readOrInitTrialMarker as jest.Mock).mockImplementation((_deviceId: string, dbTrialStartedAt: Date) => ({
      effectiveTrialStartedAt: dbTrialStartedAt,
      tampered: false,
    }));
  });

  afterAll(() => {
    fs.rmSync(testPublicKeyPath, { force: true });
  });

  it('initializes a fresh trial on first-ever status check', async () => {
    const { service, prisma } = buildService(null);
    const status = await service.getStatus();
    expect(prisma.appLicense.create).toHaveBeenCalledTimes(1);
    expect(status.state).toBe('TRIAL_ACTIVE');
    expect(status.remainingDays).toBe(7);
  });

  it('reports TRIAL_EXPIRED once 7 days have elapsed since trialStartedAt', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * DAY_MS);
    const { service } = buildService(buildRow({ trialStartedAt: eightDaysAgo, trialHighWaterMark: eightDaysAgo }));
    const status = await service.getStatus();
    expect(status.state).toBe('TRIAL_EXPIRED');
    expect(status.remainingDays).toBe(0);
  });

  it('detects a rolled-back system clock and does not grant extra trial time from it', async () => {
    // يحاكي أن آخر فحص شرعي حدث حين كانت الساعة متقدّمة 10 أيام (سواء بسبب تلاعب أو
    // خطأ) — إعادة الساعة الآن إلى "اليوم" يجب ألا تُعيد حساب الأيام المتبقية بافتراض
    // بداية جديدة، بل تُستخدم آخر نقطة معروفة (trialHighWaterMark) كمرجع
    const now = new Date();
    const futureHighWaterMark = new Date(now.getTime() + 10 * DAY_MS);
    const { service, prisma } = buildService(
      buildRow({ trialStartedAt: now, trialHighWaterMark: futureHighWaterMark }),
    );
    const status = await service.getStatus();
    expect(status.clockAnomalyDetected).toBe(true);
    expect(status.state).toBe('TRIAL_EXPIRED');
    const updateCall = prisma.appLicense.update.mock.calls[0][0];
    expect(updateCall.data.clockAnomalyDetected).toBe(true);
  });

  it('accepts a validly signed, correctly-bound license and persists it', async () => {
    const { service, store } = buildService(buildRow());
    const key = makeLicenseKey();
    const status = await service.activate(key);
    expect(status.state).toBe('LICENSED');
    expect(store.row?.licenseKey).toBe(key);
    expect(store.row?.activatedAt).toBeInstanceOf(Date);
  });

  it('rejects activation with an invalid signature', async () => {
    const { service } = buildService(buildRow());
    const { privateKey: attackerKey } = crypto.generateKeyPairSync('ed25519');
    const payload = { deviceId: DEVICE_ID, issuedAt: new Date().toISOString(), expiresAt: null };
    const signature = crypto.sign(null, Buffer.from(JSON.stringify(payload), 'utf-8'), attackerKey);
    const forgedKey = Buffer.from(JSON.stringify({ payload, signature: signature.toString('base64') }), 'utf-8').toString(
      'base64url',
    );
    await expect(service.activate(forgedKey)).rejects.toMatchObject({
      response: { code: 'INVALID_SIGNATURE' },
    });
  });

  it('rejects activation with a license issued for a different device', async () => {
    const { service } = buildService(buildRow());
    const key = makeLicenseKey({ deviceId: 'a-different-device' });
    await expect(service.activate(key)).rejects.toMatchObject({ response: { code: 'WRONG_DEVICE' } });
  });

  it('reflects a previously activated license as LICENSED on a later status check (persistence across restarts)', async () => {
    const key = makeLicenseKey();
    const activatedRow = buildRow({ licenseKey: key, activatedAt: new Date() });
    // يحاكي إعادة تشغيل التطبيق: خدمة جديدة تماماً تقرأ صفاً مخزَّناً مسبقاً فقط،
    // بلا أي استدعاء activate() سابق في نفس العملية
    const { service } = buildService(activatedRow);
    const status = await service.getStatus();
    expect(status.state).toBe('LICENSED');
  });

  it('blocks the device (does not silently fall back to a fresh trial) when the stored license fails verification', async () => {
    // صف قاعدة بيانات يحمل ترخيصاً صالحاً... لكن لجهاز آخر — يحاكي نسخ قاعدة البيانات
    // من جهاز مرخَّص إلى جهاز آخر غير مرخَّص
    const wrongDeviceKey = makeLicenseKey({ deviceId: 'the-original-licensed-device' });
    const { service } = buildService(buildRow({ licenseKey: wrongDeviceKey, activatedAt: new Date() }));
    const status = await service.getStatus();
    expect(status.state).toBe('LICENSE_INVALID');
  });
});
