'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/i18n/locale-provider';

// مبدّل اللغة داخل التطبيق (بعد تسجيل الدخول) — بنفس نمط ThemeToggle بالضبط (زر
// أيقونة واحد يُبدّل بين حالتين). قبل هذا المكوّن، LanguageSwitcher في صفحة تسجيل
// الدخول (app/login/page.tsx) كانت الطريقة الوحيدة لتغيير اللغة — لا وجود لها في
// الـ Topbar بعد الدخول، وهذا بالضبط سبب المشكلة المُبلَّغ عنها أصلاً (نصوص تبقى
// عربية رغم اختيار الفرنسية: لأن المستخدم لم يكن يملك وسيلة لتغيير اللغة أصلاً هنا)
export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale();
  const next = locale === 'ar' ? 'fr' : 'ar';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('topbar.switchLanguageAriaLabel')}
      onClick={() => setLocale(next)}
    >
      <Languages className="h-5 w-5" />
    </Button>
  );
}
