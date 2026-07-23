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

function ChangeEmailCard() {
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
      setError(Array.isArray(message) ? message[0] : message ?? 'حدث خطأ أثناء تغيير البريد الإلكتروني');
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
            <Label htmlFor="currentEmail">البريد الإلكتروني الحالي</Label>
            <Input id="currentEmail" disabled value={user?.email ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newEmail">البريد الإلكتروني الجديد</Label>
            <Input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPasswordForEmail">كلمة المرور الحالية</Label>
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
      {saved && <p className="text-sm text-primary">تم تغيير البريد الإلكتروني بنجاح</p>}

      <div className="flex justify-end md:max-w-md">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'جارٍ الحفظ...' : 'تغيير البريد الإلكتروني'}
        </Button>
      </div>
    </form>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(Array.isArray(message) ? message[0] : message ?? 'حدث خطأ أثناء تغيير كلمة المرور');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
    if (newPassword !== confirmPassword) return setError('كلمتا المرور الجديدتان غير متطابقتين');
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
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
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
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
      {saved && <p className="text-sm text-primary">تم تغيير كلمة المرور بنجاح</p>}

      <div className="flex justify-end md:max-w-md">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'جارٍ الحفظ...' : 'تغيير كلمة المرور'}
        </Button>
      </div>
    </form>
  );
}

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">إعدادات المدير</h1>
        <p className="mt-1 text-sm text-muted-foreground">تغيير البريد الإلكتروني وكلمة مرور حساب المدير</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">البريد الإلكتروني</h2>
        <ChangeEmailCard />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">كلمة المرور</h2>
        <ChangePasswordCard />
      </div>
    </div>
  );
}
