'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
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
import type { Role } from '@/types';

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/pos', label: 'نقطة البيع', icon: ShoppingCart },
  { href: '/products', label: 'المنتجات', icon: Package },
  { href: '/customers', label: 'الزبائن', icon: Users },
  { href: '/suppliers', label: 'الموردون', icon: Truck },
  { href: '/purchases', label: 'المشتريات', icon: PackagePlus },
  { href: '/reports', label: 'التقارير', icon: BarChart3 },
  { href: '/settings', label: 'إعدادات المحل', icon: Settings, roles: ['ADMIN'] },
  { href: '/account', label: 'إعدادات المدير', icon: KeyRound, roles: ['ADMIN'] },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const items = NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map(({ href, label, icon: Icon }) => {
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex h-16 items-center gap-2 border-b border-border px-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
        ع
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">إدارة العقاقير الكهربائية</p>
        <p className="text-xs text-muted-foreground">جملة وتقسيط</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-l md:border-border md:bg-card">
      <SidebarBrand />
      <NavLinks />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          'absolute inset-y-0 right-0 flex w-72 flex-col bg-card transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-2">
          <SidebarBrand />
          <button onClick={onClose} className="p-2 text-muted-foreground" aria-label="إغلاق القائمة">
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
      </div>
    </div>
  );
}
