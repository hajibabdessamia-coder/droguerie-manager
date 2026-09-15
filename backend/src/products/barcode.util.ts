// توليد والتحقق من باركود EAN-13 (معيار التجزئة العالمي، 13 رقماً). الأرقام المولَّدة
// تلقائياً هنا تستخدم بادئة "20" أو "21" — النطاق (20–29) الذي تحجزه GS1 رسمياً
// للاستخدام الداخلي/المحلي (In-Store) لكل محل على حدة، تفادياً لأي تصادم مع باركود
// حقيقي صادر عن مُصنِّع فعلي يحمل نفس الرقم.
const INTERNAL_PREFIXES = ['20', '21'];

// خانة التحقق (checksum) وفق خوارزمية EAN-13 القياسية: من اليمين لليسار، الأرقام في
// المواضع الفردية (1، 3، 5...) تُضرب في 3، والزوجية في 1، ثم يُكمَّل المجموع لأقرب عشرة
function computeCheckDigit(twelveDigits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  return computeCheckDigit(value.slice(0, 12)) === Number(value[12]);
}

export function generateEan13Candidate(): string {
  const prefix = INTERNAL_PREFIXES[Math.floor(Math.random() * INTERNAL_PREFIXES.length)];
  let body = prefix;
  for (let i = 0; i < 10; i++) body += Math.floor(Math.random() * 10);
  return body + computeCheckDigit(body);
}
