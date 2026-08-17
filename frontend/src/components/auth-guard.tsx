'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useLocale } from '@/i18n/locale-provider';

const FORCED_PASSWORD_CHANGE_PATH = '/account';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { t } = useLocale();

  const mustChangePassword = !!user?.mustChangePassword;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (mustChangePassword && pathname !== FORCED_PASSWORD_CHANGE_PATH) {
      router.replace(FORCED_PASSWORD_CHANGE_PATH);
    }
  }, [hasHydrated, user, mustChangePassword, pathname, router]);

  if (!hasHydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t('authGuard.verifyingSession')}
      </div>
    );
  }

  if (mustChangePassword && pathname !== FORCED_PASSWORD_CHANGE_PATH) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t('authGuard.verifyingSession')}
      </div>
    );
  }

  return <>{children}</>;
}
