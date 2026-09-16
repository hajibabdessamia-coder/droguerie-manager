import type { Locale } from '@/i18n/types';

// أسماء الفئات/الوحدة التي يزرعها التطبيق تلقائياً عند أول تثبيت (راجع
// prisma/migrations/20260915103500_add_categories_and_units و prisma/seed.ts) — بيانات
// حقيقية في قاعدة البيانات يمكن للمستخدم إعادة تسميتها بحرية بأي لغة، لذا لا تُترجَم إلا
// حين تُطابق بالضبط أحد هذه الأسماء الافتراضية كما زرعها التطبيق؛ أي اسم غيّره المستخدم
// (أو أي فئة/وحدة أنشأها بنفسه) يبقى معروضاً كما هو في قاعدة البيانات دون أي ترجمة.
const DEFAULT_CATEGORY_LABELS_FR: Record<string, string> = {
  'الفئة الأولى': 'Catégorie 1',
  'الفئة الثانية': 'Catégorie 2',
  'الفئة الثالثة': 'Catégorie 3',
  'الفئة الرابعة': 'Catégorie 4',
};

const DEFAULT_UNIT_LABELS_FR: Record<string, string> = {
  'قطعة': 'Pièce',
  'لفة': 'Rouleau',
};

function translateDefault(name: string, locale: Locale, table: Record<string, string>): string {
  return locale === 'fr' ? (table[name] ?? name) : name;
}

export function translateCategoryName(name: string, locale: Locale): string {
  return translateDefault(name, locale, DEFAULT_CATEGORY_LABELS_FR);
}

export function translateUnitName(name: string, locale: Locale): string {
  return translateDefault(name, locale, DEFAULT_UNIT_LABELS_FR);
}
