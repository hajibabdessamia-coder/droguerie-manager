'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getPrintBridge, type PrintSettings, type PrinterInfo, type ReceiptPaper } from '@/lib/print';
import { useLocale } from '@/i18n/locale-provider';

// يظهر فقط داخل تطبيق سطح المكتب (حيث يوجد جسر الطباعة) — في متصفح عادي لا معنى له
export function PrintingSettings() {
  const { t } = useLocale();
  const [available, setAvailable] = useState(false);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [status, setStatus] = useState<'saved' | 'saveError' | 'loadError' | null>(null);

  useEffect(() => {
    const bridge = getPrintBridge();
    if (!bridge) return;
    setAvailable(true);
    Promise.all([bridge.getPrinters(), bridge.getSettings()])
      .then(([list, current]) => {
        setPrinters(list);
        setSettings(current);
      })
      .catch(() => setStatus('loadError'));
  }, []);

  if (!available) return null;

  async function update(patch: Partial<PrintSettings>) {
    const bridge = getPrintBridge();
    if (!bridge || !settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await bridge.saveSettings(next);
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? null : s)), 2000);
    } catch {
      setStatus('saveError');
    }
  }

  // طابعة محفوظة سابقاً لكنها لم تعد ظاهرة (مفصولة/محذوفة) تبقى في القائمة بعلامة
  // واضحة بدل أن تختفي بصمت ويبدو الحقل وكأنه "اسأل عند كل طباعة"
  function printerOptions(selected: string) {
    const known = printers.some((p) => p.name === selected);
    return (
      <>
        <option value="">{t('settings.printerAskEveryTime')}</option>
        {printers.map((p) => (
          <option key={p.name} value={p.name} dir="auto">
            {p.displayName}
            {p.isDefault ? t('settings.printerDefaultSuffix') : ''}
          </option>
        ))}
        {selected && !known && (
          <option value={selected} dir="auto">
            {selected}
            {t('settings.printerUnavailableSuffix')}
          </option>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">{t('settings.printingSectionTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.printingSubtitle')}</p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          {settings && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="receiptPrinter">{t('settings.receiptPrinterLabel')}</Label>
                <Select
                  id="receiptPrinter"
                  value={settings.receiptPrinter}
                  onChange={(e) => update({ receiptPrinter: e.target.value })}
                >
                  {printerOptions(settings.receiptPrinter)}
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="receiptPaper">{t('settings.receiptPaperLabel')}</Label>
                <Select
                  id="receiptPaper"
                  value={settings.receiptPaper}
                  onChange={(e) => update({ receiptPaper: e.target.value as ReceiptPaper })}
                >
                  <option value="80">{t('settings.paper80')}</option>
                  <option value="58">{t('settings.paper58')}</option>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="documentPrinter">{t('settings.documentPrinterLabel')}</Label>
                <Select
                  id="documentPrinter"
                  value={settings.documentPrinter}
                  onChange={(e) => update({ documentPrinter: e.target.value })}
                >
                  {printerOptions(settings.documentPrinter)}
                </Select>
              </div>
            </>
          )}

          {status === 'saved' && <p className="text-sm text-primary md:col-span-2">{t('settings.printingSaved')}</p>}
          {status === 'saveError' && (
            <p className="text-sm text-destructive md:col-span-2">{t('settings.printingSaveError')}</p>
          )}
          {status === 'loadError' && (
            <p className="text-sm text-destructive md:col-span-2">{t('settings.printingLoadError')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
