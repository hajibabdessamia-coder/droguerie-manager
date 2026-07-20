'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchStoreSettings, updateStoreSettings } from '@/lib/store-settings';
import { createBackup, deleteBackup, fetchBackups, openBackupsFolder, restoreBackup } from '@/lib/backup';
import { formatDateTime } from '@/lib/utils';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['store-settings'], queryFn: fetchStoreSettings });

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [ifNumber, setIfNumber] = useState('');
  const [ice, setIce] = useState('');
  const [rc, setRc] = useState('');
  const [patente, setPatente] = useState('');
  const [defaultTaxRate, setDefaultTaxRate] = useState('0');
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setName(settings.name ?? '');
      setLogoUrl(settings.logoUrl ?? '');
      setAddress(settings.address ?? '');
      setPhone(settings.phone ?? '');
      setIfNumber(settings.ifNumber ?? '');
      setIce(settings.ice ?? '');
      setRc(settings.rc ?? '');
      setPatente(settings.patente ?? '');
      setDefaultTaxRate(settings.defaultTaxRate ?? '0');
      setInitialized(true);
    }
  }, [settings, initialized]);

  const mutation = useMutation({
    mutationFn: () =>
      updateStoreSettings({
        name,
        logoUrl: logoUrl || undefined,
        address: address || undefined,
        phone: phone || undefined,
        ifNumber: ifNumber || undefined,
        ice: ice || undefined,
        rc: rc || undefined,
        patente: patente || undefined,
        defaultTaxRate: Number(defaultTaxRate) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message ?? 'حدث خطأ أثناء الحفظ');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  const { data: backups } = useQuery({ queryKey: ['backups'], queryFn: fetchBackups });
  const [restoring, setRestoring] = useState(false);

  const createBackupMutation = useMutation({
    mutationFn: createBackup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  });

  const restoreBackupMutation = useMutation({
    mutationFn: restoreBackup,
    onSuccess: () => setRestoring(true),
  });

  function handleDeleteBackup(id: string, createdAt: string) {
    if (window.confirm(`هل تريد حذف النسخة الاحتياطية بتاريخ ${formatDateTime(createdAt)}؟`)) {
      deleteBackupMutation.mutate(id);
    }
  }

  function handleRestoreBackup(id: string, createdAt: string) {
    if (
      window.confirm(
        `هل تريد استعادة النسخة الاحتياطية بتاريخ ${formatDateTime(createdAt)}؟ سيُعاد تشغيل التطبيق وسيُستبدَل كل ما تغيّر بعد هذا التاريخ.`,
      )
    ) {
      restoreBackupMutation.mutate(id);
    }
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return '—';
    return `${(bytes / (1024 * 1024)).toFixed(2)} م.ب.`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات المحل</h1>
        <p className="mt-1 text-sm text-muted-foreground">تظهر هذه المعلومات في رأس الفاتورة القانونية</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">اسم المحل</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="logoUrl">رابط الشعار (اختياري)</Label>
              <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">العنوان</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">الهاتف</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ifNumber">IF</Label>
              <Input id="ifNumber" value={ifNumber} onChange={(e) => setIfNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ice">ICE</Label>
              <Input id="ice" value={ice} onChange={(e) => setIce(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rc">RC</Label>
              <Input id="rc" value={rc} onChange={(e) => setRc(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="patente">Patente</Label>
              <Input id="patente" value={patente} onChange={(e) => setPatente(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="defaultTaxRate">نسبة الضريبة الافتراضية (TVA %)</Label>
              <Input
                id="defaultTaxRate"
                type="number"
                min="0"
                step="0.01"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-primary">تم الحفظ بنجاح</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold">النسخ الاحتياطي والاستعادة</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            تُحفظ النسخ الاحتياطية محلياً على هذا الجهاز فقط
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            {restoring ? (
              <p className="text-sm text-primary">
                تتم استعادة النسخة الاحتياطية... سيُعاد تشغيل التطبيق تلقائياً خلال لحظات.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => createBackupMutation.mutate()}
                    disabled={createBackupMutation.isPending}
                  >
                    {createBackupMutation.isPending ? 'جارٍ إنشاء نسخة...' : 'إنشاء نسخة احتياطية الآن'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openBackupsFolder()}>
                    فتح مجلد النسخ الاحتياطية
                  </Button>
                </div>

                {createBackupMutation.isError && (
                  <p className="text-sm text-destructive">تعذّر إنشاء النسخة الاحتياطية</p>
                )}
                {restoreBackupMutation.isError && (
                  <p className="text-sm text-destructive">تعذّرت استعادة النسخة الاحتياطية</p>
                )}

                <div className="flex flex-col divide-y divide-border">
                  {!backups?.length && (
                    <p className="py-3 text-sm text-muted-foreground">لا توجد نسخ احتياطية بعد</p>
                  )}
                  {backups?.map((backup) => (
                    <div key={backup.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatDateTime(backup.createdAt)}</span>
                          <Badge variant={backup.status === 'SUCCESS' ? 'default' : 'destructive'}>
                            {backup.status === 'SUCCESS' ? 'ناجحة' : 'فاشلة'}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatSize(backup.sizeBytes)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={backup.status !== 'SUCCESS' || restoreBackupMutation.isPending}
                          onClick={() => handleRestoreBackup(backup.id, backup.createdAt)}
                        >
                          استعادة
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deleteBackupMutation.isPending}
                          onClick={() => handleDeleteBackup(backup.id, backup.createdAt)}
                        >
                          حذف
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
