import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryProvider } from '@/components/query-provider';
import { LicenseGate } from '@/components/license-gate';
import { LocaleProvider } from '@/i18n/locale-provider';
import { DEFAULT_DIRECTION, DEFAULT_LOCALE } from '@/i18n/types';

const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-cairo' });

export const metadata: Metadata = {
  title: 'L7ssab Manager',
  description: 'نظام إدارة المبيعات والمخزون — نقطة بيع وجرد لأي نوع تجارة',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang/dir هنا هما القيمة الافتراضية المُخبوزة وقت البناء فقط (تصدير Next.js الثابت
  // لا يملك عرضاً من جهة الخادم وقت التشغيل) — المتحكم الفعلي باللغة أثناء التشغيل هو
  // LocaleProvider (راجع src/i18n/locale-provider.tsx)، الذي يُصحّح هاتين السمتين على
  // document.documentElement بعد mount حسب اللغة المحفوظة. suppressHydrationWarning
  // ضروري هنا لنفس السبب الذي من أجله كان موجوداً أصلاً مع ThemeProvider (next-themes)
  return (
    <html lang={DEFAULT_LOCALE} dir={DEFAULT_DIRECTION} suppressHydrationWarning>
      <body className={`${cairo.variable} font-sans antialiased`}>
        <LocaleProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryProvider>
              <LicenseGate>{children}</LicenseGate>
            </QueryProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
