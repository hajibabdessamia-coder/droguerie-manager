import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// بذرة الإنتاج: تُستخدم فقط لبناء قاعدة البيانات النموذجية التي تُشحن داخل تطبيق سطح
// المكتب. تُنشئ حساب المدير الافتراضي وإعدادات المحل فقط، بدون أي بيانات تجريبية
// (منتجات/زبائن/موردين/فواتير)، لأن هذه القاعدة تصل إلى محل حقيقي وليست للتجربة.
// راجع seed.ts للبذرة الكاملة المستخدمة في التطوير المحلي.
async function main() {
  const passwordHash = await bcrypt.hash('Admin@12345', 10);
  await prisma.user.upsert({
    where: { email: 'admin@pharma.local' },
    update: {},
    create: { name: 'المدير العام', email: 'admin@pharma.local', passwordHash, role: 'ADMIN', mustChangePassword: true },
  });

  await prisma.storeSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', name: 'اسم المحل', defaultTaxRate: 0 },
  });

  console.log('تم إعداد قاعدة البيانات النموذجية. حساب المدير: admin@pharma.local / Admin@12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
