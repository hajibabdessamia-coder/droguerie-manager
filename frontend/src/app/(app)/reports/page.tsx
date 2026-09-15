'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  exportCustomersExcel,
  exportProductsExcel,
  exportSalesExcel,
  exportSuppliersExcel,
  exportSummaryPdf,
  fetchReportSummary,
  openReportsFolder,
} from '@/lib/reports';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils';
import { useLocale } from '@/i18n/locale-provider';
import type { ReportPeriod } from '@/types';

const PERIOD_VALUES: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

const STAT_KEYS: ('salesTotal' | 'profitTotal' | 'invoiceCount' | 'purchasesValue' | 'inventoryValue')[] = [
  'salesTotal',
  'profitTotal',
  'invoiceCount',
  'purchasesValue',
  'inventoryValue',
];

export default function ReportsPage() {
  const { t, locale } = useLocale();
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [date, setDate] = useState('');

  const { data: report, isLoading } = useQuery({
    queryKey: ['report-summary', period, date],
    queryFn: () => fetchReportSummary(period, date || undefined),
  });

  const pdfMutation = useMutation({ mutationFn: () => exportSummaryPdf(period, date || undefined) });
  const salesExcelMutation = useMutation({ mutationFn: exportSalesExcel });
  const productsExcelMutation = useMutation({ mutationFn: exportProductsExcel });
  const customersExcelMutation = useMutation({ mutationFn: exportCustomersExcel });
  const suppliersExcelMutation = useMutation({ mutationFn: exportSuppliersExcel });
  const exportError =
    pdfMutation.isError ||
    salesExcelMutation.isError ||
    productsExcelMutation.isError ||
    customersExcelMutation.isError ||
    suppliersExcelMutation.isError;
  const [folderMessage, setFolderMessage] = useState<string | null>(null);
  const folderMutation = useMutation({
    mutationFn: openReportsFolder,
    onSuccess: ({ opened, path }) => {
      setFolderMessage(opened ? null : `${t('reports.filesSavedOnServerPrefix')}${path}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.reports')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('reports.subtitle')}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('reports.periodFieldLabel')}</label>
            <Select value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)} className="w-40">
              {PERIOD_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`reports.period.${value}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('reports.referenceDateLabel')}</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button type="button" variant="outline" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>
            <FileDown className="h-4 w-4" />
            {pdfMutation.isPending ? t('reports.exportPdfLoading') : t('reports.exportPdfButton')}
          </Button>
          <Button type="button" variant="outline" onClick={() => folderMutation.mutate()} disabled={folderMutation.isPending}>
            <FolderOpen className="h-4 w-4" />
            {t('reports.openFolderButton')}
          </Button>
        </CardContent>
      </Card>

      {folderMessage && <p className="text-xs text-muted-foreground">{folderMessage}</p>}
      {exportError && <p className="text-sm text-destructive">{t('reports.exportError')}</p>}

      <p className="text-xs text-muted-foreground">
        {t('reports.autoGenerationNote')}
      </p>

      {report && (
        <p className="text-sm text-muted-foreground">
          {t('reports.rangePrefix')}
          {t(`reports.period.${period}`)}
          {t('reports.rangeFrom')}
          {formatDateTime(report.start, locale)}
          {t('reports.rangeTo')}
          {formatDateTime(report.end, locale)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {STAT_KEYS.map((key) => (
          <Card key={key}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t(`reports.stats.${key}`)}</p>
              {isLoading || !report ? (
                <Skeleton className="mt-2 h-7 w-20" />
              ) : (
                <p className="mt-1 text-xl font-bold">
                  {key === 'invoiceCount' ? formatNumber(report[key], locale) : formatCurrency(report[key], locale)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('reports.topProductsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton className="h-32 w-full" />}
            {report && report.topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('reports.noDataForPeriod')}</p>
            )}
            {report && report.topProducts.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-muted-foreground">
                    <th className="py-2 font-medium">{t('common.product')}</th>
                    <th className="py-2 font-medium">{t('common.quantity')}</th>
                    <th className="py-2 font-medium">{t('reports.revenueColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.name} className="border-b border-border last:border-0">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.qty}</td>
                      <td className="py-2">{formatCurrency(p.revenue, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">{t('reports.leastProductsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton className="h-32 w-full" />}
            {report && report.leastProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('reports.noDataForPeriod')}</p>
            )}
            {report && report.leastProducts.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-muted-foreground">
                    <th className="py-2 font-medium">{t('common.product')}</th>
                    <th className="py-2 font-medium">{t('common.quantity')}</th>
                    <th className="py-2 font-medium">{t('reports.revenueColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.leastProducts.map((p) => (
                    <tr key={p.name} className="border-b border-border last:border-0">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.qty}</td>
                      <td className="py-2">{formatCurrency(p.revenue, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">{t('reports.excelExportTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => salesExcelMutation.mutate()}
            disabled={salesExcelMutation.isPending}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('reports.exportSalesButton')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => productsExcelMutation.mutate()}
            disabled={productsExcelMutation.isPending}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('reports.exportProductsButton')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => customersExcelMutation.mutate()}
            disabled={customersExcelMutation.isPending}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('nav.customers')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => suppliersExcelMutation.mutate()}
            disabled={suppliersExcelMutation.isPending}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('nav.suppliers')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
