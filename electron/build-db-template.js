// سكريبت وقت البناء فقط (لا يُشحن مع التطبيق ولا يُنفَّذ عند التشغيل): يبني قاعدة بيانات
// SQLite نموذجية — المخطط الكامل مُطبَّقاً + حساب مدير واحد وإعدادات محل افتراضية فقط،
// بلا أي بيانات تجريبية — لتُنسخ داخل userData عند أول تشغيل فعلي للتطبيق (راجع main.js).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');
const templatePath = path.join(__dirname, 'resources', 'db-template.sqlite');

fs.mkdirSync(path.dirname(templatePath), { recursive: true });
for (const suffix of ['', '-journal']) {
  const p = templatePath + suffix;
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

const env = {
  ...process.env,
  DATABASE_URL: `file:${templatePath.replace(/\\/g, '/')}`,
};

console.log('Applying migrations to template database...');
execSync('npx prisma migrate deploy', { cwd: backendDir, env, stdio: 'inherit' });

console.log('Seeding production template (admin account + store settings only)...');
execSync('npx ts-node prisma/seed.production.ts', { cwd: backendDir, env, stdio: 'inherit' });

if (!fs.existsSync(templatePath)) {
  throw new Error(`Template database was not created at ${templatePath}`);
}
const { size } = fs.statSync(templatePath);
console.log(`Template database ready: ${templatePath} (${size} bytes)`);
