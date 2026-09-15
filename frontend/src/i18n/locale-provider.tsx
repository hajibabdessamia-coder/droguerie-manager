'use client';

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ar } from './dictionaries/ar';
import { fr } from './dictionaries/fr';
import {
  DEFAULT_LOCALE,
  LOCALE_DIRECTIONS,
  type Dictionary,
  type Direction,
  type Locale,
  type TranslationKey,
} from './types';

const DICTIONARIES: Record<Locale, Dictionary> = { ar, fr };
// مُجمَّد عمداً على الاسم القديم: تغييره يُفقد كل مستخدم حالي لغته المختارة
// ويُعيده للعربية الافتراضية بلا فائدة — المفتاح داخلي ولا يظهر في الواجهة
const STORAGE_KEY = 'pharma-manager-locale';

function isLocale(value: string | null): value is Locale {
  return value === 'ar' || value === 'fr';
}

function readStoredLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

function resolveTranslation(dict: unknown, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dict);
  return typeof value === 'string' ? value : key;
}

interface LocaleContextValue {
  locale: Locale;
  dir: Direction;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // القيمة الأولية تبقى DEFAULT_LOCALE عمداً (وليست القيمة المحفوظة في localStorage)
  // لأن هذا مكوّن عميل (client component) يُصادِف عند الـ hydration محتوى HTML ثابتاً
  // بُني وقت البناء بلغة DEFAULT_LOCALE فقط (تصدير Next.js الثابت output: 'export' —
  // لا يوجد عرض من جهة الخادم وقت التشغيل الفعلي). قراءة localStorage مباشرة هنا كانت
  // ستُنتج نص فرنسي عند أول عرض بينما HTML الثابت يحتوي نصاً عربياً، فيسبب Hydration
  // Mismatch حقيقي من React. بدل ذلك: نُطابق الافتراضي أولاً (hydration نظيف)، ثم
  // نُصحّح اللغة الفعلية بعد mount عبر useLayoutEffect أدناه — بالضبط نفس نمط
  // ThemeProvider (next-themes) الموجود مسبقاً في هذا المشروع لمشكلة السمة (dark/light)
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useLayoutEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_DIRECTIONS[locale];
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const t = useMemo(() => {
    const dict = DICTIONARIES[locale];
    return (key: TranslationKey) => resolveTranslation(dict, key);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir: LOCALE_DIRECTIONS[locale], setLocale, t }),
    [locale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
