'use client';

import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeEmail, changePassword } from '@/lib/auth';
import { useAuthStore } from '@/store/auth-store';
import { useLocale } from '@/i18n/locale-provider';

function ChangeEmailCard() {
  const { t } = useLocale();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => changeEmail(currentPassword, newEmail),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      setCurrentPassword('');
      setNewEmail('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(Array.isArray(message) ? message[0] : message ?? t('account.emailChangeError'));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentEmail">{t('account.currentEmailLabel')}</Label>
            <Input id="currentEmail" disabled value={user?.email ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newEmail">{t('account.newEmailLabel')}</Label>
            <Input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPasswordForEmail">{t('account.currentPasswordLabel')}</Label>
            <Input
              id="currentPasswordForEmail"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-primary">{t('account.emailChangedSuccess')}</p>}

      <div className="flex justify-end md:max-w-md">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('account.changeEmailButton')}
        </Button>
      </div>
    </form>
  );
}

function ChangePasswordCard() {
  const { t } = useLocale();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      if (user) updateUser({ ...user, mustChangePassword: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(Array.isArray(message) ? message[0] : message ?? t('account.passwordChangeError'));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError(t('account.passwordTooShort'));
    if (newPassword !== confirmPassword) return setError(t('account.passwordMismatch'));
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">{t('account.currentPasswordLabel')}</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">{t('account.newPasswordLabel')}</Label>
            <Input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">{t('account.confirmNewPasswordLabel')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-primary">{t('account.passwordChangedSuccess')}</p>}

      <div className="flex justify-end md:max-w-md">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('account.changePasswordButton')}
        </Button>
      </div>
    </form>
  );
}

export default function AccountPage() {
  const { t } = useLocale();
  const mustChangePassword = useAuthStore((s) => !!s.user?.mustChangePassword);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.account')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('account.subtitle')}</p>
      </div>

      {mustChangePassword && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {t('account.mustChangePasswordNotice')}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('account.emailSectionTitle')}</h2>
        <ChangeEmailCard />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('login.passwordLabel')}</h2>
        <ChangePasswordCard />
      </div>
    </div>
  );
}
