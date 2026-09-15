'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useLocale } from '@/i18n/locale-provider';
import type { Locale } from '@/i18n/types';
import type { AuthUser } from '@/types';

// أسماء اللغات هنا (العربية / Français) لا تُترجَم أبداً — هذا هو السلوك الصحيح
// المعتاد لمبدّل اللغة: كل اسم يُكتب دائماً بلغته هو، بصرف النظر عن اللغة الحالية
// للواجهة، حتى يتعرّف عليه المستخدم بصرياً أياً كانت اللغة النشطة حالياً
const LANGUAGE_NAMES: Record<Locale, string> = { ar: 'العربية', fr: 'Français' };

function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="mb-1 flex justify-center gap-2" role="group" aria-label={t('languageSwitcher.label')}>
      {(Object.keys(LANGUAGE_NAMES) as Locale[]).map((code) => (
        <Button
          key={code}
          type="button"
          variant={locale === code ? 'default' : 'outline'}
          size="sm"
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {LANGUAGE_NAMES[code]}
        </Button>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post<{ accessToken: string; user: AuthUser }>('/auth/login', {
        email,
        password,
      });
      login(data.user, data.accessToken);
      router.replace('/dashboard');
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        // err.response.data?.message يأتي من الخادم الخلفي (auth.service.ts) بالعربية
        // دائماً حالياً — يُترك كما هو عمداً، ترجمة رسائل الخادم مؤجّلة لمرحلة لاحقة.
        // القيمة الاحتياطية (?? ...) فقط من تأليف الواجهة الأمامية، لذا تُترجَم
        setError(err.response.data?.message ?? t('login.invalidCredentials'));
      } else {
        setError(t('login.connectionError'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <LanguageSwitcher />
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            L7
          </div>
          <h1 className="text-lg font-semibold text-foreground">{t('login.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                {t('login.emailLabel')}
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@l7ssab.local"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                {t('login.passwordLabel')}
              </label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? t('login.submitLoading') : t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
