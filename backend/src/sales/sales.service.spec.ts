import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SalesService } from './sales.service';

const PRODUCT = {
  id: 'prod-1',
  name: 'Test Product',
  quantity: 10,
  retailPrice: 15,
  wholesalePrice: 10,
};

function buildService(overrides?: { jwtVerify?: jest.Mock }) {
  const txSale = { create: jest.fn(async (args) => ({ id: 'sale-1', invoiceNumber: 'INV-20260101-0001', ...args.data })) };
  const tx = {
    sale: { ...txSale, count: jest.fn().mockResolvedValue(0) },
    priceOverrideGrant: { create: jest.fn() },
    product: { update: jest.fn() },
    stockMovement: { create: jest.fn() },
    customer: { update: jest.fn() },
  };

  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue([PRODUCT]) },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
  };

  const jwt = { verify: overrides?.jwtVerify ?? jest.fn() };
  const audit = { log: jest.fn() };

  const service = new SalesService(prisma as never, jwt as never, audit as never);
  return { service, prisma, jwt, audit, tx };
}

describe('SalesService.create', () => {
  it('throws when requested quantity exceeds stock', async () => {
    const { service } = buildService();
    await expect(
      service.create('seller-1', {
        invoiceType: 'TICKET',
        paymentMethod: 'CASH',
        discount: 0,
        taxRate: 0,
        amountPaid: 1000,
        items: [{ productId: 'prod-1', quantity: 999, priceType: 'RETAIL' }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a CUSTOM price item without an override token', async () => {
    const { service } = buildService();
    await expect(
      service.create('seller-1', {
        invoiceType: 'TICKET',
        paymentMethod: 'CASH',
        discount: 0,
        taxRate: 0,
        amountPaid: 100,
        items: [{ productId: 'prod-1', quantity: 1, priceType: 'CUSTOM', customPrice: 100 }],
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an override token that is not from an admin', async () => {
    const jwtVerify = jest.fn().mockReturnValue({ sub: 'user-1', role: 'SELLER', type: 'override' });
    const { service } = buildService({ jwtVerify });
    await expect(
      service.create('seller-1', {
        invoiceType: 'TICKET',
        paymentMethod: 'CASH',
        discount: 0,
        taxRate: 0,
        amountPaid: 100,
        overrideToken: 'fake-token',
        items: [{ productId: 'prod-1', quantity: 1, priceType: 'CUSTOM', customPrice: 100 }],
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a CUSTOM price item with a valid admin override token', async () => {
    const jwtVerify = jest.fn().mockReturnValue({ sub: 'admin-1', role: 'ADMIN', type: 'override' });
    const { service, tx } = buildService({ jwtVerify });

    await service.create('seller-1', {
      invoiceType: 'TICKET',
      paymentMethod: 'CASH',
      discount: 0,
      taxRate: 0,
      amountPaid: 100,
      overrideToken: 'valid-token',
      items: [{ productId: 'prod-1', quantity: 1, priceType: 'CUSTOM', customPrice: 100 }],
    } as never);

    expect(tx.priceOverrideGrant.create).toHaveBeenCalledWith({
      data: { saleId: 'sale-1', grantedBy: 'admin-1' },
    });
  });

  it('resolves WHOLESALE vs RETAIL prices and computes totals correctly', async () => {
    const { service, tx } = buildService();

    await service.create('seller-1', {
      invoiceType: 'TICKET',
      paymentMethod: 'CASH',
      discount: 5,
      taxRate: 20,
      amountPaid: 100,
      items: [{ productId: 'prod-1', quantity: 3, priceType: 'WHOLESALE' }],
    } as never);

    // subtotal = 3 * 10 = 30; taxable = 30 - 5 = 25; tax = 25 * 0.20 = 5; total = 30
    expect(tx.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subtotal: 30, discount: 5, taxAmount: 5, total: 30, changeDue: 70 }),
      }),
    );
  });

  it('decrements product stock and records a SALE stock movement', async () => {
    const { service, tx } = buildService();

    await service.create('seller-1', {
      invoiceType: 'TICKET',
      paymentMethod: 'CASH',
      discount: 0,
      taxRate: 0,
      amountPaid: 100,
      items: [{ productId: 'prod-1', quantity: 4, priceType: 'RETAIL' }],
    } as never);

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { quantity: { decrement: 4 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ productId: 'prod-1', type: 'SALE', quantity: -4 }) }),
    );
  });

  it('increments customer balance only when paymentMethod is CREDIT with a customer', async () => {
    const { service, tx } = buildService();

    await service.create('seller-1', {
      customerId: 'cust-1',
      invoiceType: 'TICKET',
      paymentMethod: 'CREDIT',
      discount: 0,
      taxRate: 0,
      amountPaid: 0,
      items: [{ productId: 'prod-1', quantity: 1, priceType: 'RETAIL' }],
    } as never);

    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { balance: { increment: 15 } },
    });
  });
});
