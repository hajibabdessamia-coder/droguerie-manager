import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

function buildService(products: { id: string; quantity: number; minStock: number }[]) {
  const tx = {
    product: { update: jest.fn().mockResolvedValue({ id: 'p1', quantity: 15 }) },
    stockMovement: { create: jest.fn() },
  };
  const prisma = {
    product: {
      findMany: jest.fn().mockResolvedValue(products),
      findUnique: jest.fn().mockImplementation(({ where: { id } }) => products.find((p) => p.id === id) ?? null),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
  };
  const service = new ProductsService(prisma as never);
  return { service, prisma, tx };
}

describe('ProductsService', () => {
  describe('lowStock', () => {
    it('returns only products at or below their minimum stock', async () => {
      const { service } = buildService([
        { id: 'p1', quantity: 2, minStock: 10 },
        { id: 'p2', quantity: 50, minStock: 10 },
        { id: 'p3', quantity: 10, minStock: 10 },
      ]);
      const result = await service.lowStock();
      expect(result.map((p) => p.id)).toEqual(['p1', 'p3']);
    });

    it('returns an empty list when no products are low on stock', async () => {
      const { service } = buildService([{ id: 'p1', quantity: 100, minStock: 10 }]);
      expect(await service.lowStock()).toEqual([]);
    });
  });

  describe('adjustStock', () => {
    it('throws NotFoundException for a missing product', async () => {
      const { service } = buildService([]);
      await expect(service.adjustStock('missing', { delta: 5 })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('increments quantity and records an ADJUSTMENT stock movement', async () => {
      const { service, tx } = buildService([{ id: 'p1', quantity: 15, minStock: 5 }]);
      await service.adjustStock('p1', { delta: 5, reason: 'جرد يدوي' });

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { quantity: { increment: 5 } },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: { productId: 'p1', type: 'ADJUSTMENT', quantity: 5, reason: 'جرد يدوي' },
      });
    });
  });
});
