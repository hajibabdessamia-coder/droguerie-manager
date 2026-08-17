// Packaging wrapper: backend/node_modules ships to customers as-is via
// extraResources (see package.json), so it must not contain devDependencies
// (jest, typescript, ts-node, @nestjs/cli, prisma CLI, ...) — none of that is
// needed to run the already-compiled dist/src/main.js, and it was bloating
// every distributable (installer, zip, portable) with tens of thousands of
// files that don't belong in a shipped product. `npm prune --omit=dev` is
// destructive to the working tree, so it's always paired with a matching
// `npm install` in `finally`, even if packaging itself fails.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..', '..', 'backend');
const electronDir = path.join(__dirname, '..');
const certPath = path.join(electronDir, 'resources', 'dev-signing-cert.pfx');

// راجع scripts/make-dev-cert.ps1: توقيع الملف التنفيذي — حتى بشهادة ذاتية التوقيع
// غير موثوقة الجذر — ضروري فعلياً على هذا الجهاز، وليس تحسيناً اختيارياً: سياسة
// Windows Code Integrity (Smart App Control) ترفض تشغيل الملف التنفيذي غير
// الموقَّع تماماً بخطأ "did not meet the Enterprise signing level requirements"،
// مؤكَّد بإعادة إنتاج العطل وحله فعلياً على هذا الجهاز. بدون هذه الشهادة، يفشل
// البناء بصمت لناحية التوقيع فقط (electron-builder يتخطى التوقيع إن لم يجدها)
// لذا فشل الشرط أدناه بشكل صريح بدل شحن ملف قد لا يعمل على هذا الجهاز مجدداً.
if (!fs.existsSync(certPath)) {
  console.error(`Signing certificate not found at ${certPath}`);
  console.error('Run: powershell -ExecutionPolicy Bypass -File scripts/make-dev-cert.ps1');
  process.exit(1);
}

if (!process.env.CSC_KEY_PASSWORD) {
  console.error('CSC_KEY_PASSWORD environment variable is not set.');
  console.error('Set it to the password used when the signing certificate was created');
  console.error('(scripts/make-dev-cert.ps1), then re-run this script. Example (PowerShell):');
  console.error('  $env:CSC_KEY_PASSWORD = "<your-cert-password>"; node scripts/pack-win.js');
  process.exit(1);
}

function run(cmd, cwd, extraEnv) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
}

try {
  run('npm prune --omit=dev', backendDir);
  run('npx electron-builder --win nsis zip', electronDir, {
    CSC_LINK: certPath,
    CSC_KEY_PASSWORD: process.env.CSC_KEY_PASSWORD,
  });
} finally {
  run('npm install', backendDir);
}
