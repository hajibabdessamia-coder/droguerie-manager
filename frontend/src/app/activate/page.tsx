'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { activateLicense, fetchLicenseStatus } from '@/lib/license';
import { useLocale } from '@/i18n/locale-provider';
import type { TranslationKey } from '@/i18n/types';

const STATUS_MESSAGE_KEY: Record<string, TranslationKey> = {
  TRIAL_ACTIVE: 'activate.status.trialActive',
  TRIAL_EXPIRED: 'activate.status.trialExpired',
  LICENSED: 'activate.status.licensed',
  LICENSE_EXPIRED: 'activate.status.licenseExpired',
  LICENSE_INVALID: 'activate.status.licenseInvalid',
};

const ACTIVATION_ERROR_KEY: Record<string, TranslationKey> = {
  MALFORMED: 'activate.errors.MALFORMED',
  INVALID_SIGNATURE: 'activate.errors.INVALID_SIGNATURE',
  WRONG_DEVICE: 'activate.errors.WRONG_DEVICE',
  EXPIRED: 'activate.errors.EXPIRED',
};

export default function ActivatePage() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['license-status'],
    queryFn: fetchLicenseStatus,
  });

  const mutation = useMutation({
    mutationFn: () => activateLicense(licenseKey.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(['license-status'], updated);
      setLicenseKey('');
    },
    onError: (err) => {
      const code = isAxiosError(err) ? (err.response?.data as { code?: string } | undefined)?.code : undefined;
      setError(code && ACTIVATION_ERROR_KEY[code] ? t(ACTIVATION_ERROR_KEY[code]) : t('activate.errors.GENERIC'));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!licenseKey.trim()) return;
    mutation.mutate();
  }

  async function handleCopyDeviceId() {
    if (!status?.deviceId) return;
    await navigator.clipboard.writeText(status.deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const licensed = status?.state === 'LICENSED' || status?.state === 'TRIAL_ACTIVE';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            L7
          </div>
          <h1 className="text-lg font-semibold text-foreground">{t('activate.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('activate.subtitle')}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

          {status && (
            <p
              className={
                licensed
                  ? 'rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary'
                  : 'rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'
              }
            >
              {t(STATUS_MESSAGE_KEY[status.state] ?? 'activate.status.licenseInvalid')}
              {status.state === 'TRIAL_ACTIVE' && status.remainingDays !== undefined && (
                <> {status.remainingDays} {t('activate.daysRemainingSuffix')}</>
              )}
            </p>
          )}

          {status?.clockAnomalyDetected && (
            <p className="text-xs text-destructive">{t('activate.clockAnomalyWarning')}</p>
          )}

          {status && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deviceId">{t('activate.deviceIdLabel')}</Label>
              <div className="flex items-center gap-2">
                <code id="deviceId" className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm">
                  {status.deviceId}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={handleCopyDeviceId}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {copied && <p className="text-xs text-primary">{t('activate.deviceIdCopied')}</p>}
              <p className="text-xs text-muted-foreground">{t('activate.deviceIdHelp')}</p>
            </div>
          )}

          {!licensed && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="licenseKey">{t('activate.licenseKeyLabel')}</Label>
                <Textarea
                  id="licenseKey"
                  rows={4}
                  required
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder={t('activate.licenseKeyPlaceholder')}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {mutation.isSuccess && <p className="text-sm text-primary">{t('activate.activationSuccess')}</p>}
              <Button type="submit" disabled={mutation.isPending || !licenseKey.trim()}>
                {mutation.isPending ? t('activate.activateLoading') : t('activate.activateButton')}
              </Button>
            </form>
          )}

          {licensed && <p className="text-sm text-muted-foreground">{t('activate.alreadyActiveNotice')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
