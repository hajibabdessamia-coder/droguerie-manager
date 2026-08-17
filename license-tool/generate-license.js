// أداة البائع لإصدار ترخيص لجهاز عميل محدَّد. تُشغَّل يدوياً على جهاز البائع فقط
// (يحتاج private-key.pem من generate-keypair.js في نفس هذا المجلد) — لا تُشحن هذه
// الأداة ولا مجلد license-tool/ بأكمله داخل التطبيق المُعبّأ إطلاقاً.
//
// الاستخدام:
//   node generate-license.js --device-id <معرّف الجهاز> --days 365
//   node generate-license.js --device-id <معرّف الجهاز> --perpetual
//
// معرّف الجهاز يحصل عليه العميل من شاشة "تفعيل الترخيص" داخل التطبيق ويرسله للبائع.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--device-id') args.deviceId = argv[++i];
    else if (argv[i] === '--days') args.days = Number(argv[++i]);
    else if (argv[i] === '--perpetual') args.perpetual = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.deviceId) {
  console.error('الاستخدام: node generate-license.js --device-id <معرّف> [--days 365 | --perpetual]');
  process.exit(1);
}
if (!args.perpetual && (!args.days || args.days <= 0)) {
  console.error('يجب تحديد --days <عدد موجب> أو --perpetual');
  process.exit(1);
}

const privateKeyPath = path.join(__dirname, 'private-key.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error(`المفتاح الخاص غير موجود في ${privateKeyPath} — شغّل generate-keypair.js أولاً`);
  process.exit(1);
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath, 'utf-8'));

const issuedAt = new Date().toISOString();
const expiresAt = args.perpetual ? null : new Date(Date.now() + args.days * 24 * 60 * 60 * 1000).toISOString();

// حمولة الترخيص (payload): معرّف الجهاز المستهدف + تاريخ الإصدار + تاريخ الانتهاء
// (أو null لترخيص دائم). يُوقَّع هذا الكائن تماماً كما هو (JSON.stringify بترتيب
// المفاتيح كما كُتبت هنا) — يجب أن يُعاد بناؤه بنفس الترتيب عند التحقق في الخادم
// الخلفي (راجع backend/src/license/license-crypto.util.ts)
const payload = { deviceId: args.deviceId, issuedAt, expiresAt };
const payloadJson = JSON.stringify(payload);
const signature = crypto.sign(null, Buffer.from(payloadJson, 'utf-8'), privateKey);

const licenseKey = Buffer.from(JSON.stringify({ payload, signature: signature.toString('base64') }), 'utf-8').toString(
  'base64url',
);

console.log('مفتاح الترخيص (أرسله للعميل ليلصقه في شاشة التفعيل):');
console.log('');
console.log(licenseKey);
console.log('');
console.log(`الجهاز: ${args.deviceId}`);
console.log(`الانتهاء: ${expiresAt ?? 'لا يوجد (دائم)'}`);
