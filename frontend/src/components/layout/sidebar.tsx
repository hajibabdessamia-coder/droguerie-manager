'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FileText,
  KeyRound,
  LayoutDashboard,
  Package,
  PackagePlus,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useLocale } from '@/i18n/locale-provider';
import type { TranslationKey } from '@/i18n/types';
import type { Role } from '@/types';

const NAV_ITEMS: { href: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/pos', labelKey: 'nav.pos', icon: ShoppingCart },
  { href: '/sales', labelKey: 'nav.sales', icon: FileText },
  { href: '/products', labelKey: 'nav.products', icon: Package },
  { href: '/customers', labelKey: 'nav.customers', icon: Users },
  { href: '/suppliers', labelKey: 'nav.suppliers', icon: Truck },
  { href: '/purchases', labelKey: 'nav.purchases', icon: PackagePlus },
  { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings, roles: ['ADMIN'] },
  { href: '/account', labelKey: 'nav.account', icon: KeyRound, roles: ['ADMIN'] },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const { t } = useLocale();
  const items = NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  const { t } = useLocale();
  return (
    <div className="flex h-16 items-center gap-2 border-b border-border px-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
        ع
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">{t('common.appName')}</p>
        <p className="text-xs text-muted-foreground">{t('common.appTagline')}</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    // md:border-e (border-inline-end) بدل md:border-l: يبقى الحد على الجانب المحاذي
    // للمحتوى الرئيسي تلقائياً في الاتجاهين (يسار الشريط الجانبي في RTL، يمين الشريط
    // الجانبي في LTR) — راجع app-shell.tsx: الحاوية الأب flex عادي بلا ترتيب صريح،
    // فموضع الشريط الجانبي (يمين/يسار الشاشة) ينعكس تلقائياً مع dir دون أي تغيير هناك
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-e md:border-border md:bg-card">
      <SidebarBrand />
      <NavLinks />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dir, t } = useLocale();
  const isRtl = dir === 'rtl';

  return (
    <div className={cn('fixed inset-0 z-50 md:hidden', open ? '' : 'pointer-events-none')}>
      <div
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute inset-y-0 flex w-72 flex-col bg-card transition-transform duration-200 ease-in-out',
          // اللوحة المنزلقة (off-canvas) تُوضَع وموضِعها/اتجاه انزلاقها بحساب صريح حسب
          // الاتجاه: لا يوجد خاصية CSS منطقية بديلة لـ translate-x تُحل تلقائياً مع dir
          // كما هو الحال مع border-e/ps/pe، لذا يلزم هذا الشرط الصريح هنا فقط
          isRtl ? 'right-0' : 'left-0',
          open ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-2">
          <SidebarBrand />
          <button onClick={onClose} className="p-2 text-muted-foreground" aria-label={t('common.closeMenu')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
      </div>
    </div>
  );
}
