import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@12345', 10);
  await prisma.user.upsert({
    where: { email: 'admin@pharma.local' },
    update: {},
    create: { name: 'المدير العام', email: 'admin@pharma.local', passwordHash, role: 'ADMIN' },
  });

  await prisma.storeSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', name: 'محل العقاقير الكهربائية للجملة والتقسيط', defaultTaxRate: 0 },
  });

  const demoPasswordHash = await bcrypt.hash('123456', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@demo.com' },
    update: {},
    create: { name: 'حساب تجريبي', email: 'demo@demo.com', passwordHash: demoPasswordHash, role: 'ADMIN' },
  });

  console.log('تمت تهيئة البيانات الأولية. حساب المدير: admin@pharma.local / Admin@12345');
  console.log('حساب تجريبي: demo@demo.com / 123456');

  await seedDemoData(demoUser.id);
}

// بيانات تجريبية (منتجات، زبائن، موردون، فاتورة شراء وبيع) لتجربة البرنامج مباشرة بعد النشر.
// محمية بفحص وجود مسبق حتى يبقى تشغيل seed أكثر من مرة آمناً (بدون تكرار).
async function seedDemoData(sellerId: string) {
  const alreadySeeded = await prisma.product.findUnique({ where: { internalCode: 'DEMO-001' } });
  if (alreadySeeded) {
    console.log('البيانات التجريبية موجودة مسبقاً، تم تخطي الإدخال.');
    return;
  }

  const [manufacturer1, manufacturer2] = await Promise.all([
    prisma.manufacturer.upsert({
      where: { name: 'شركة النور للإضاءة' },
      update: {},
      create: { name: 'شركة النور للإضاءة' },
    }),
    prisma.manufacturer.upsert({
      where: { name: 'الأطلس للأدوات الكهربائية' },
      update: {},
      create: { name: 'الأطلس للأدوات الكهربائية' },
    }),
  ]);

  const productDefs = [
    { code: 'DEMO-001', name: 'مصباح LED 12 واط', group: 'GROUP_1', manufacturerId: manufacturer1.id, purchasePrice: 8, retailPrice: 18, wholesalePrice: 13, quantity: 40, minStock: 10 },
    { code: 'DEMO-002', name: 'مصباح LED 20 واط', group: 'GROUP_1', manufacturerId: manufacturer1.id, purchasePrice: 12, retailPrice: 25, wholesalePrice: 19, quantity: 5, minStock: 10 },
    { code: 'DEMO-003', name: 'مقبس كهربائي مزدوج', group: 'GROUP_1', manufacturerId: manufacturer2.id, purchasePrice: 6, retailPrice: 15, wholesalePrice: 10, quantity: 45, minStock: 10 },
    { code: 'DEMO-004', name: 'قاطع كهربائي 20A', group: 'GROUP_2', manufacturerId: manufacturer2.id, purchasePrice: 15, retailPrice: 32, wholesalePrice: 24, quantity: 30, minStock: 5 },
    { code: 'DEMO-005', name: 'قاطع كهربائي 32A', group: 'GROUP_2', manufacturerId: manufacturer2.id, purchasePrice: 20, retailPrice: 42, wholesalePrice: 32, quantity: 3, minStock: 5 },
    { code: 'DEMO-006', name: 'منظم جهد كهربائي', group: 'GROUP_2', manufacturerId: manufacturer2.id, purchasePrice: 90, retailPrice: 160, wholesalePrice: 130, quantity: 6, minStock: 5 },
    { code: 'DEMO-007', name: 'كابل كهربائي 2.5مم (لفة)', group: 'GROUP_3', manufacturerId: manufacturer2.id, purchasePrice: 35, retailPrice: 65, wholesalePrice: 52, quantity: 25, minStock: 5 },
    { code: 'DEMO-008', name: 'كابل كهربائي 4مم (لفة)', group: 'GROUP_3', manufacturerId: manufacturer2.id, purchasePrice: 55, retailPrice: 95, wholesalePrice: 78, quantity: 8, minStock: 5 },
    { code: 'DEMO-009', name: 'مفتاح إنارة أحادي', group: 'GROUP_4', manufacturerId: manufacturer1.id, purchasePrice: 4, retailPrice: 10, wholesalePrice: 7, quantity: 60, minStock: 15 },
    { code: 'DEMO-010', name: 'مفتاح إنارة مزدوج', group: 'GROUP_4', manufacturerId: manufacturer1.id, purchasePrice: 6, retailPrice: 14, wholesalePrice: 10, quantity: 12, minStock: 15 },
  ] as const;

  // المنتجان اللذان سيُستخدمان في فاتورة الشراء التجريبية يُنشآن بكمية أقل من الهدف
  // بمقدار كمية الشراء، ثم تُعيدهما فاتورة الشراء إلى الكمية الهدف كما هو موضح أعلاه
  const purchaseQty: Record<string, number> = { 'DEMO-001': 10, 'DEMO-004': 8 };

  const products = await Promise.all(
    productDefs.map((p) =>
      prisma.product.create({
        data: {
          internalCode: p.code,
          name: p.name,
          group: p.group,
          manufacturerId: p.manufacturerId,
          purchasePrice: p.purchasePrice,
          retailPrice: p.retailPrice,
          wholesalePrice: p.wholesalePrice,
          quantity: p.quantity - (purchaseQty[p.code] ?? 0),
          minStock: p.minStock,
        },
      }),
    ),
  );
  const productByCode = new Map(products.map((p) => [p.internalCode, p]));

  const [, retailCustomer] = await Promise.all([
    prisma.customer.create({ data: { name: 'زبون جملة تجريبي', phone: '0600000001', type: 'WHOLESALE' } }),
    prisma.customer.create({ data: { name: 'زبون تجزئة تجريبي', phone: '0600000002', type: 'RETAIL' } }),
  ]);
  await Promise.all([
    prisma.supplier.create({ data: { name: 'مورد تجريبي للإضاءة', phone: '0600000003' } }),
    prisma.supplier.create({ data: { name: 'مورد تجريبي للأدوات الكهربائية', phone: '0600000004' } }),
  ]);
  const supplier = await prisma.supplier.create({ data: { name: 'المورد الرئيسي التجريبي', phone: '0600000005' } });

  // فاتورة شراء تجريبية فعلية (تحدّث المخزون ورصيد المورد بنفس منطق PurchasesService)
  const purchaseItems = [
    { product: productByCode.get('DEMO-001')!, quantity: purchaseQty['DEMO-001'] },
    { product: productByCode.get('DEMO-004')!, quantity: purchaseQty['DEMO-004'] },
  ];
  const purchaseTotal = purchaseItems.reduce((sum, i) => sum + i.quantity * Number(i.product.purchasePrice), 0);

  await prisma.$transaction(async (tx) => {
    await tx.purchase.create({
      data: {
        supplierId: supplier.id,
        userId: sellerId,
        invoiceRef: 'DEMO-SUP-INV-1',
        total: purchaseTotal,
        items: {
          create: purchaseItems.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            purchasePrice: i.product.purchasePrice,
            total: i.quantity * Number(i.product.purchasePrice),
          })),
        },
      },
    });
    for (const item of purchaseItems) {
      await tx.product.update({ where: { id: item.product.id }, data: { quantity: { increment: item.quantity } } });
      await tx.stockMovement.create({
        data: { productId: item.product.id, type: 'PURCHASE', quantity: item.quantity, reason: 'فاتورة شراء تجريبية' },
      });
    }
    await tx.supplier.update({ where: { id: supplier.id }, data: { balance: { increment: purchaseTotal } } });
  });

  // فاتورة بيع تجريبية فعلية (تحدّث المخزون بنفس منطق SalesService) لإظهار بيانات في لوحة التحكم والتقارير
  const saleItemsDef = [
    { product: productByCode.get('DEMO-001')!, quantity: 3, priceType: 'RETAIL' as const },
    { product: productByCode.get('DEMO-009')!, quantity: 5, priceType: 'RETAIL' as const },
  ];
  const saleItemsData = saleItemsDef.map((i) => {
    const unitPrice = Number(i.product.retailPrice);
    return { productId: i.product.id, quantity: i.quantity, unitPrice, priceType: i.priceType, total: unitPrice * i.quantity };
  });
  const subtotal = saleItemsData.reduce((sum, i) => sum + i.total, 0);
  const today = new Date();
  const invoiceNumber = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-DEMO1`;

  await prisma.$transaction(async (tx) => {
    await tx.sale.create({
      data: {
        invoiceNumber,
        invoiceType: 'TICKET',
        customerId: retailCustomer.id,
        sellerId,
        subtotal,
        discount: 0,
        taxRate: 0,
        taxAmount: 0,
        total: subtotal,
        amountPaid: subtotal,
        changeDue: 0,
        paymentMethod: 'CASH',
        items: { create: saleItemsData },
      },
    });
    for (const item of saleItemsData) {
      await tx.product.update({ where: { id: item.productId }, data: { quantity: { decrement: item.quantity } } });
      await tx.stockMovement.create({
        data: { productId: item.productId, type: 'SALE', quantity: -item.quantity, reason: `بيع تجريبي #${invoiceNumber}` },
      });
    }
  });

  console.log('تم إدخال البيانات التجريبية: منتجات، زبائن، موردون، فاتورة شراء وفاتورة بيع.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
