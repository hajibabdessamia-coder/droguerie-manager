import type { ar } from './dictionaries/ar';

export type Locale = 'ar' | 'fr';
export type Direction = 'rtl' | 'ltr';

export const DEFAULT_LOCALE: Locale = 'ar';

export const LOCALE_DIRECTIONS: Record<Locale, Direction> = {
  ar: 'rtl',
  fr: 'ltr',
};

export const DEFAULT_DIRECTION: Direction = LOCALE_DIRECTIONS[DEFAULT_LOCALE];

// ar.ts يستخدم `as const` (يحفظ كل قيمة كنوع حرفي، مثال: النوع "تسجيل الدخول" وليس
// string) — مفيد لبناء TranslationKey أدناه، لكنه يجعل `typeof ar` غير صالح كنوع
// لقاموس لغة أخرى (fr.ts) لأنه سيجبر كل نص فرنسي أن يساوي حرفياً نفس النص العربي.
// Widen<T> يوسّع كل قيمة نصية-حرفية إلى `string` عادي مع الحفاظ على شكل الكائن
// المتداخل نفسه — هذا هو الشكل (Dictionary) الذي يجب أن يطابقه أي قاموس لغة
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof ar>;

// يبني اتحاد كل مسارات المفاتيح المتداخلة الممكنة كسلاسل نقطية (مثال: 'login.title')
// انطلاقاً من شكل قاموس ar.ts — بحيث يرفض TypeScript أي مفتاح غير موجود فعلياً في
// القاموس عند استدعاء t('...')، دون الحاجة لكتابة كل مفتاح يدوياً هنا
type Paths<T, Prefix extends string = ''> = T extends string
  ? Prefix extends ''
    ? never
    : Prefix
  : {
      [K in keyof T & string]: Paths<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>;
    }[keyof T & string];

export type TranslationKey = Paths<Dictionary>;
