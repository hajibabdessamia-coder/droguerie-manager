import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let productId: string;
  let saleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (saleId) {
      await prisma.priceOverrideGrant.deleteMany({ where: { saleId } });
      await prisma.saleItem.deleteMany({ where: { saleId } });
      await prisma.sale.deleteMany({ where: { id: saleId } });
    }
    if (productId) {
      await prisma.stockMovement.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    await app.close();
  });

  it('rejects requests without a token', async () => {
    await request(app.getHttpServer()).get('/api/products').expect(401);
  });

  it('rejects login with a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@l7ssab.local', password: 'wrong-password' })
      .expect(401);
  });

  it('logs in with the seeded admin account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@l7ssab.local', password: 'Admin@12345' })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('ADMIN');
    adminToken = res.body.accessToken;
  });

  it('creates a product', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Test Product',
        internalCode: `E2E-${Date.now()}`,
        purchasePrice: 10,
        retailPrice: 15,
        wholesalePrice: 12,
        quantity: 20,
        minStock: 5,
      })
      .expect(201);

    productId = res.body.id;
    expect(res.body.quantity).toBe(20);
  });

  it('creates a sale and decrements product stock accordingly', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoiceType: 'TICKET',
        paymentMethod: 'CASH',
        amountPaid: 30,
        items: [{ productId, quantity: 2, priceType: 'RETAIL' }],
      })
      .expect(201);

    saleId = res.body.id;
    expect(res.body.total).toBe('30');

    const product = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(product.body.quantity).toBe(18);
  });

  it('rejects a custom-price sale without an admin override token', async () => {
    await request(app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoiceType: 'TICKET',
        paymentMethod: 'CASH',
        amountPaid: 100,
        items: [{ productId, quantity: 1, priceType: 'CUSTOM', customPrice: 100 }],
      })
      .expect(401);
  });

  it('reflects the new sale in the dashboard summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.todayTransactionsCount).toBeGreaterThanOrEqual(1);
  });
});
