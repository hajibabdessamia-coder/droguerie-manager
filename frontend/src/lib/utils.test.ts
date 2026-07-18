import { cn, formatCurrency, formatDateTime } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center');
  });

  it('resolves conflicting Tailwind classes to the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('drops falsy values', () => {
    expect(cn('flex', false, undefined, null, 'gap-2')).toBe('flex gap-2');
  });
});

describe('formatCurrency', () => {
  it('formats a number with two decimal places and the currency suffix', () => {
    const result = formatCurrency(1234.5);
    expect(result).toContain('1.234,50');
    expect(result).toContain('د.م.');
  });

  it('accepts a numeric string (as returned by the API for Decimal fields)', () => {
    expect(formatCurrency('30')).toBe(formatCurrency(30));
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toContain('0,00');
  });
});

describe('formatDateTime', () => {
  it('formats an ISO string into a localized date and time', () => {
    const result = formatDateTime('2026-07-17T14:30:00');
    expect(result).toContain('2026');
    expect(result).toContain('14:30');
  });

  it('accepts a Date object directly', () => {
    const result = formatDateTime(new Date('2026-01-01T09:00:00'));
    expect(result).toContain('2026');
  });
});
