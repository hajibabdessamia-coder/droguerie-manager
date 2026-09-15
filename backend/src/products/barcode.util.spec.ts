import { generateEan13Candidate, isValidEan13 } from './barcode.util';

describe('barcode.util', () => {
  it('generates a 13-digit numeric code', () => {
    const code = generateEan13Candidate();
    expect(code).toMatch(/^\d{13}$/);
  });

  it('generates a code with a valid EAN-13 check digit', () => {
    const code = generateEan13Candidate();
    expect(isValidEan13(code)).toBe(true);
  });

  it('generated codes use the reserved internal-use prefix (20 or 21)', () => {
    const code = generateEan13Candidate();
    expect(['20', '21']).toContain(code.slice(0, 2));
  });

  it('generates different codes across calls (no fixed value)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateEan13Candidate()));
    expect(codes.size).toBeGreaterThan(1);
  });

  it('validates a known-correct EAN-13 code', () => {
    // 4006381333931 هو مثال رسمي شائع الاستخدام في توثيق GS1 لخوارزمية التحقق
    expect(isValidEan13('4006381333931')).toBe(true);
  });

  it('rejects a code with a wrong check digit', () => {
    expect(isValidEan13('4006381333930')).toBe(false);
  });

  it('rejects a code that is not exactly 13 digits', () => {
    expect(isValidEan13('123')).toBe(false);
    expect(isValidEan13('12345678901234')).toBe(false);
    expect(isValidEan13('400638133393a')).toBe(false);
  });
});
