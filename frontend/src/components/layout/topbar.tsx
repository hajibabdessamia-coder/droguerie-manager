'use client';

import { LogOut, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleToggle } from '@/components/locale-toggle';
import { fetchStoreSettings } from '@/lib/store-settings';
import { fetchLicenseStatus } from '@/lib/license';
import { useAuthStore } from '@/store/auth-store';
import { useLocale } from '@/i18n/locale-provider';
import type { TranslationKey } from '@/i18n/types';

const ROLE_LABEL_KEY: Record<string, TranslationKey> = {
  ADMIN: 'common.roles.ADMIN',
  SELLER: 'common.roles.SELLER',
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useLocale();
  // نفس queryKey المستخدم في صفحة الإعدادات (settings/page.tsx) — حفظ الإعدادات هناك
  // يستدعي invalidateQueries على نفس المفتاح، فيُحدَّث الاسم هنا تلقائياً دون أي ربط إضافي
  const { data: storeSettings } = useQuery({ queryKey: ['store-settings'], queryFn: fetchStoreSettings });
  // نفس queryKey المستخدم في LicenseGate (راجع components/license-gate.tsx) — لا يُطلق
  // طلباً إضافياً، فقط يقرأ نفس النتيجة المخزَّنة في ذاكرة React Query
  const { data: licenseStatus } = useQuery({ queryKey: ['license-status'], queryFn: fetchLicenseStatus });

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} aria-label={t('common.openMenu')}>
        <Menu className="h-5 w-5" />
      </Button>
      {/* اسم المحل بيانات أدخلها المستخدم عبر إعدادات المحل — لا يُترجَم أبداً، يُعرض كما هو */}
      <div className="hidden truncate text-sm font-semibold text-foreground md:block">{storeSettings?.name}</div>
      <div className="flex items-center gap-2">
        {licenseStatus?.state === 'TRIAL_ACTIVE' && (
          <Badge variant="secondary">
            {t('topbar.trialRemainingPrefix')} {licenseStatus.remainingDays} {t('topbar.trialRemainingSuffix')}
          </Badge>
        )}
        <LocaleToggle />
        <ThemeToggle />
        {user && (
          <div className="flex items-center gap-2 rounded-lg border border-border py-1.5 ps-1.5 pe-3 text-sm">
            {/* اسم المستخدم بيانات حساب حقيقية (User.name) — لا يُترجَم */}
            <span className="text-foreground">{user.name}</span>
            <Badge variant="secondary">{ROLE_LABEL_KEY[user.role] ? t(ROLE_LABEL_KEY[user.role]) : user.role}</Badge>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label={t('topbar.logout')}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
