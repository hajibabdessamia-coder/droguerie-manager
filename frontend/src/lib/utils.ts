import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Locale } from '@/i18n/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// وسم Intl الفعلي لكل لغة مدعومة، ونص وحدة الدرهم المغربي المعروض لكل لغة — نقطة
// مركزية واحدة بدل تكرار نفس الشرط (locale === 'fr' ? ... : ...) في كل دالة تنسيق.
// العملة تبقى الدرهم المغربي دائماً في اللغتين، فقط طريقة كتابتها تختلف
const INTL_LOCALE: Record<Locale, string> = { ar: 'ar-MA', fr: 'fr-FR' };
const CURRENCY_SUFFIX: Record<Locale, string> = { ar: 'د.م.', fr: 'MAD' };

// المعامل الثاني (locale) اختياري وافتراضيه 'ar' عمداً: عشرات نقاط الاستدعاء الأخرى
// لهاتين الدالتين عبر التطبيق (POS، الفواتير، التقارير، إلخ) لم تُحوَّل بعد لنظام
// الترجمة في هذه المرحلة، وتستدعيها بدون معامل اللغة — يجب أن تستمر بنفس المخرجات
// العربية الحالية تماماً دون أي تغيير حتى تُحوَّل تلك الصفحات في مرحلة لاحقة
export function formatNumber(value: number, locale: Locale = 'ar') {
  return value.toLocaleString(INTL_LOCALE[locale]);
}

export function formatCurrency(value: number | string, locale: Locale = 'ar') {
  const num = typeof value === 'string' ? Number(value) : value;
  const formatted = num.toLocaleString(INTL_LOCALE[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${CURRENCY_SUFFIX[locale]}`;
}

export function formatDateTime(value: string | Date, locale: Locale = 'ar') {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString(INTL_LOCALE[locale], { dateStyle: 'short', timeStyle: 'short' });
}
