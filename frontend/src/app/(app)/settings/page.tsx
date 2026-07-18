'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchStoreSettings, updateStoreSettings } from '@/lib/store-settings';

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
    </div>
  );
}
