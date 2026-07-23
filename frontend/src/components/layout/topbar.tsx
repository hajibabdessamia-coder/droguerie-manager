'use client';

import { LogOut, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { fetchStoreSettings } from '@/lib/store-settings';
import { useAuthStore } from '@/store/auth-store';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'مدير', SELLER: 'بائع' };

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  // نفس queryKey المستخدم في صفحة الإعدادات (settings/page.tsx) — حفظ الإعدادات هناك
  // يستدعي invalidateQueries على نفس المفتاح، فيُحدَّث الاسم هنا تلقائياً دون أي ربط إضافي
  const { data: storeSettings } = useQuery({ queryKey: ['store-settings'], queryFn: fetchStoreSettings });

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} aria-label="فتح القائمة">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="hidden truncate text-sm font-semibold text-foreground md:block">{storeSettings?.name}</div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user && (
          <div className="flex items-center gap-2 rounded-lg border border-border py-1.5 pl-1.5 pr-3 text-sm">
            <span className="text-foreground">{user.name}</span>
            <Badge variant="secondary">{ROLE_LABEL[user.role] ?? user.role}</Badge>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
