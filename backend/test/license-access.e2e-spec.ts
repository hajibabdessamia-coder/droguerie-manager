import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { LicenseService } from '../src/license/license.service';

// يختبر تحديداً إصلاح الثغرة المكتشفة في اختبار قبول المرحلة 12: LicenseController
// كان يحمل @LicensePublic() فقط دون @Public()، فيبقى محجوباً بواسطة JwtAuthGuard رغم
// إعفائه من LicenseGuard — ما يعني أن جهازاً منتهي الصلاحية لا يملك JWT أبداً (لأن
// LicenseGuard يحجب /auth/login أيضاً) ولا يمكنه بالتالي الوصول لـ /license/status
// أو /license/activate لعرض معرّف الجهاز أو تفعيل ترخيص جديد — قفل دائم.
//
// LicenseService مُستبدَلة بالكامل هنا (mock ثابت التحكم) بدل الاتصال الحقيقي بقاعدة
// بيانات التطوير — لا يُقرأ أو يُكتب صف AppLicense الحقيقي في backend/prisma/dev.db
// إطلاقاً خلال هذا الملف، تحديداً لأن المهمة تتطلب صراحة عدم المساس بذلك الصف.
describe('License access guard wiring (e2e)', () => {
  let app: INestApplication;
  let getStatusMock: jest.Mock;
  let activateMock: jest.Mock;

  beforeAll(async () => {
    getStatusMock = jest.fn().mockResolvedValue({
      state: 'TRIAL_ACTIVE',
      remainingDays: 7,
      deviceId: 'TEST-DEVICE-0001',
      clockAnomalyDetected: false,
    });
    activateMock = jest.fn().mockResolvedValue({
      state: 'LICENSED',
      deviceId: 'TEST-DEVICE-0001',
      clockAnomalyDetected: false,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LicenseService)
      .useValue({ getStatus: getStatusMock, activate: activateMock })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterEach(() => {
    getStatusMock.mockClear();
    activateMock.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('while trial is active', () => {
    it('reaches GET /license/status with no Authorization header at all', async () => {
      const res = await request(app.getHttpServer()).get('/api/license/status').expect(200);
      expect(res.body.state).toBe('TRIAL_ACTIVE');
    });

    it('reaches POST /license/activate with no Authorization header at all', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/license/activate')
        .send({ licenseKey: 'irrelevant-for-this-test' })
        .expect(201);
      expect(res.body.state).toBe('LICENSED');
      expect(activateMock).toHaveBeenCalledWith('irrelevant-for-this-test');
    });

    it('still rejects an unrelated protected business endpoint without a token', async () => {
      // يتأكد أن إصلاح @Public() اقتصر على LicenseController فقط، ولم يُضعف
      // JwtAuthGuard لبقية التطبيق
      await request(app.getHttpServer()).get('/api/products').expect(401);
    });
  });

  describe('once the trial/license is expired', () => {
    beforeEach(() => {
      getStatusMock.mockResolvedValue({
        state: 'TRIAL_EXPIRED',
        remainingDays: 0,
        deviceId: 'TEST-DEVICE-0001',
        clockAnomalyDetected: false,
      });
    });

    it('still reaches GET /license/status (this is the exact bug being fixed)', async () => {
      const res = await request(app.getHttpServer()).get('/api/license/status').expect(200);
      expect(res.body.state).toBe('TRIAL_EXPIRED');
    });

    it('still reaches POST /license/activate so a purchased license can be applied', async () => {
      await request(app.getHttpServer())
        .post('/api/license/activate')
        .send({ licenseKey: 'a-newly-purchased-license-key' })
        .expect(201);
      expect(activateMock).toHaveBeenCalledWith('a-newly-purchased-license-key');
    });

    it('still blocks /auth/login via LicenseGuard (no JWT can ever be obtained)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@pharma.local', password: 'Admin@12345' })
        .expect(403);
      expect(res.body.code).toBe('LICENSE_REQUIRED');
    });

    it('still blocks normal API usage via LicenseGuard', async () => {
      const res = await request(app.getHttpServer()).get('/api/products').expect(403);
      expect(res.body.code).toBe('LICENSE_REQUIRED');
    });
  });
});
