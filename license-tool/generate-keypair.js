// أداة تُشغَّل مرة واحدة فقط (من طرف البائع/المالك، على جهازه الخاص، خارج التطبيق
// المُعبّأ تماماً) لإنشاء زوج مفاتيح Ed25519 الخاص بتوقيع التراخيص. المفتاح الخاص
// (private-key.pem) يبقى هنا فقط ولا يُنسخ أبداً إلى backend/ أو frontend/ أو electron/؛
// المفتاح العلني (public-key.pem) هو الوحيد الذي يُنسخ يدوياً إلى
// electron/resources/license-public-key.pem ليُشحن داخل التطبيق للتحقق فقط (وليس التوقيع).
//
// الاستخدام:
//   node generate-keypair.js
//
// إن كان زوج مفاتيح موجوداً مسبقاً في هذا المجلد، ترفض الأداة الكتابة فوقه لتفادي
// إبطال كل التراخيص الصادرة سابقاً عن طريق الخطأ — احذف private-key.pem/public-key.pem
// يدوياً أولاً إن كنت تقصد فعلاً توليد زوج جديد.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const privateKeyPath = path.join(__dirname, 'private-key.pem');
const publicKeyPath = path.join(__dirname, 'public-key.pem');

if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) {
  console.error('يوجد زوج مفاتيح بالفعل في هذا المجلد. احذف private-key.pem وpublic-key.pem');
  console.error('يدوياً أولاً إن كنت تقصد توليد زوج جديد فعلاً — هذا يُبطل كل التراخيص السابقة.');
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

fs.writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
fs.writeFileSync(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));

console.log('تم إنشاء زوج المفاتيح:');
console.log(`  خاص (لا يُشارَك أبداً، يبقى هنا فقط): ${privateKeyPath}`);
console.log(`  علني (يُنسخ إلى electron/resources/license-public-key.pem): ${publicKeyPath}`);
