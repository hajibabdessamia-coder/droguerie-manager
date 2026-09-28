import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SalesService } from './sales.service';

const PRODUCT = {
  id: 'prod-1',
  name: 'Test Product',
  quantity: 10,
  retailPrice: 15,
  wholesalePrice: 10,
};

function buildService(overrides?: { jwtVerify?: jest.Mock; saleFindUnique?: jest.Mock }) {
  const txSale = { create: jest.fn(async (args) => ({ id: 'sale-1', invoiceNumber: 'INV-20260101-0001', ...args.data })) };
  const txSaleReturn = {
    create: jest.fn(async (args) => ({ id: 'return-1', returnNumber: 'RET-20260101-0001', ...args.data })),
    count: jest.fn().mockResolvedValue(0),
  };
  const tx = {
    sale: { ...txSale, count: jest.fn().mockResolvedValue(0) },
    saleReturn: txSaleReturn,
    priceOverrideGrant: { create: jest.fn() },
    product: { update: jest.fn() },
    stockMovement: { create: jest.fn() },
    customer: { update: jest.fn() },
  };

  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue([PRODUCT]) },
    sale: { findUnique: overrides?.saleFindUnique ?? jest.fn() },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
  };

  const jwt = { verify: overrides?.jwtVerify ?? jest.fn() };
  const audit = { log: jest.fn() };

  const service = new SalesService(prisma as never, jwt as never, audit as never);
  return { service, prisma, jwt, audit, tx };
}

// فاتورة بيع افتراضية لسطر واحد: 5 وحدات × 15 = 75 قبل خصم/ضريبة الفاتورة (10 خصم، 10% ضريبة)
function buildSoldSale(overrides?: { returns?: unknown[]; paymentMethod?: string; customerId?: string | null }) {
  return {
    id: 'sale-1',
    invoiceNumber: 'INV-20260101-0001',
    subtotal: 75,
    discount: 10,
    taxRate: 10,
    total: 71.5,
    paymentMethod: overrides?.paymentMethod ?? 'CASH',
    customerId: overrides?.customerId ?? null,
    items: [
      { id: 'item-1', productId: 'prod-1', quantity: 5, unitPrice: 15, product: { name: 'Test Product' } },
    ],
    returns: overrides?.returns ?? [],
  };
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

describe('SalesService.createReturn', () => {
  it('throws NotFoundException for a saleItemId that does not belong to the sale', async () => {
    const saleFindUnique = jest.fn().mockResolvedValue(buildSoldSale());
    const { service } = buildService({ saleFindUnique });

    await expect(
      service.createReturn('sale-1', 'admin-1', { items: [{ saleItemId: 'not-real', quantity: 1 }] } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException when the returned quantity exceeds the sold quantity', async () => {
    const saleFindUnique = jest.fn().mockResolvedValue(buildSoldSale());
    const { service } = buildService({ saleFindUnique });

    await expect(
      service.createReturn('sale-1', 'admin-1', { items: [{ saleItemId: 'item-1', quantity: 6 }] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a quantity that exceeds what remains after a previous return on the same line', async () => {
    const previousReturn = { items: [{ saleItemId: 'item-1', quantity: 4 }] };
    const saleFindUnique = jest.fn().mockResolvedValue(buildSoldSale({ returns: [previousReturn] }));
    const { service } = buildService({ saleFindUnique });

    // بيعت 5، أُرجعت 4 سابقاً، يتبقى 1 قابل للإرجاع — طلب إرجاع 2 يتجاوز المتبقي
    await expect(
      service.createReturn('sale-1', 'admin-1', { items: [{ saleItemId: 'item-1', quantity: 2 }] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restocks the product and records a RETURN stock movement', async () => {
    const saleFindUnique = jest.fn().mockResolvedValue(buildSoldSale());
    const { service, tx } = buildService({ saleFindUnique });

    await service.createReturn('sale-1', 'admin-1', { items: [{ saleItemId: 'item-1', quantity: 2 }] } as never);

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { quantity: { increment: 2 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ productId: 'prod-1', type: 'RETURN', quantity: 2 }) }),
    );
  });

  it('decrements customer balance only when the original sale was CREDIT with a customer', async () => {
    const saleFindUnique = jest
      .fn()
      .mockResolvedValue(buildSoldSale({ paymentMethod: 'CREDIT', customerId: 'cust-1' }));
    const { service, tx } = buildService({ saleFindUnique });

    await service.createReturn('sale-1', 'admin-1', { items: [{ saleItemId: 'item-1', quantity: 5 }] } as never);

    // إرجاع الكمية بأكملها بدون خصم/ضريبة إضافيين على مستوى الاختبار = المبلغ المسترجع الكامل
    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cust-1' }, data: { balance: { decrement: expect.any(Number) } } }),
    );
  });

  it('does not touch the customer balance for a CASH sale', async () => {
    const saleFindUnique = jest.fn().mockResolvedValue(buildSoldSale({ paymentMethod: 'CASH' }));
    const { service, tx } = buildService({ saleFindUnique });

    await service.createReturn('sale-1', 'admin-1', { items: [{ saleItemId: 'item-1', quantity: 1 }] } as never);

    expect(tx.customer.update).not.toHaveBeenCalled();
  });

  it('splits the original sale discount/tax proportionally across the returned amount', async () => {
    const saleFindUnique = jest.fn().mockResolvedValue(buildSoldSale());
    const { service, tx } = buildService({ saleFindUnique });

    // subtotal الفاتورة 75 (5×15)، خصم 10، ضريبة 10%. إرجاع سطرين (2×15=30) = 40% من subtotal
    await service.createReturn('sale-1', 'admin-1', { items: [{ saleItemId: 'item-1', quantity: 2 }] } as never);

    const call = (tx.saleReturn.create as jest.Mock).mock.calls[0][0];
    expect(call.data.subtotal).toBeCloseTo(30);
    expect(call.data.discountShare).toBeCloseTo(4); // 10 × 40%
    expect(call.data.taxShare).toBeCloseTo(2.6); // (30 - 4) × 10%
    expect(call.data.total).toBeCloseTo(28.6);
  });
});

describe('SalesService.remove', () => {
  it('throws BadRequestException when the sale already has returns recorded', async () => {
    const saleFindUnique = jest.fn().mockResolvedValue(buildSoldSale({ returns: [{ items: [] }] }));
    const { service } = buildService({ saleFindUnique });

    await expect(service.remove('sale-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
