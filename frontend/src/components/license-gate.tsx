'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchLicenseStatus } from '@/lib/license';
import { useLocale } from '@/i18n/locale-provider';

const ACTIVATE_PATH = '/activate';
const BLOCKED_STATES = new Set(['TRIAL_EXPIRED', 'LICENSE_EXPIRED', 'LICENSE_INVALID']);

// بوابة مركزية أعلى من AuthGuard (تُغلّف حتى /login) — راجع خطة المرحلة 12: حجب
// "الاستخدام العادي للتطبيق" يشمل شاشة الدخول نفسها، وليس فقط الصفحات بعد المصادقة.
// الفرض الحقيقي يحدث في الخادم الخلفي (LicenseGuard) على كل طلب API؛ هذا المكوّن مجرد
// تجربة استخدام توجّه المستخدم مباشرة لشاشة التفعيل بدل رؤية شاشات فارغة/أخطاء متكررة
export function LicenseGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['license-status'],
    queryFn: fetchLicenseStatus,
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
  });

  const blocked = data ? BLOCKED_STATES.has(data.state) : false;

  useEffect(() => {
    if (isLoading) return;
    if (blocked && pathname !== ACTIVATE_PATH) {
      router.replace(ACTIVATE_PATH);
    } else if (!blocked && data && pathname === ACTIVATE_PATH) {
      router.replace('/login');
    }
  }, [isLoading, blocked, data, pathname, router]);

  // فشل الفحص (مثال: الخادم الخلفي لم يبدأ بعد أثناء إقلاع Electron) لا يُفترَض أنه
  // حجب — تُعرَض الواجهة بشكل طبيعي وتُعاد المحاولة تلقائياً عبر retry/refetchInterval
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t('licenseGate.verifying')}
      </div>
    );
  }

  if (!isError && blocked && pathname !== ACTIVATE_PATH) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t('licenseGate.verifying')}
      </div>
    );
  }

  return <>{children}</>;
}
