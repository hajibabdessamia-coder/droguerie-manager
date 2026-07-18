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
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { ReportPeriod } from '@/types';

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'يومي' },
  { value: 'weekly', label: 'أسبوعي' },
  { value: 'monthly', label: 'شهري' },
  { value: 'yearly', label: 'سنوي' },
];

const STAT_ITEMS: { key: 'salesTotal' | 'profitTotal' | 'invoiceCount' | 'purchasesValue' | 'inventoryValue'; label: string }[] = [
  { key: 'salesTotal', label: 'إجمالي المبيعات' },
  { key: 'profitTotal', label: 'الأرباح' },
  { key: 'invoiceCount', label: 'عدد الفواتير' },
  { key: 'purchasesValue', label: 'قيمة المشتريات' },
  { key: 'inventoryValue', label: 'قيمة المخزون' },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [date, setDate] = useState('');

  const { data: report, isLoading } = useQuery({
    queryKey: ['report-summary', period, date],
    queryFn: () => fetchReportSummary(period, date || undefined),
  });

  const pdfMutation = useMutation({ mutationFn: () => exportSummaryPdf(period, date || undefined) });
  const [folderMessage, setFolderMessage] = useState<string | null>(null);
  const folderMutation = useMutation({
    mutationFn: openReportsFolder,
    onSuccess: ({ opened, path }) => {
      setFolderMessage(opened ? null : `الملفات محفوظة على الخادم في: ${path}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">التقارير</h1>
        <p className="mt-1 text-sm text-muted-foreground">تقارير تلقائية عن المبيعات والأرباح والمخزون</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">الفترة</label>
            <Select value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)} className="w-40">
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">التاريخ المرجعي</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button type="button" variant="outline" onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>
            <FileDown className="h-4 w-4" />
            {pdfMutation.isPending ? 'جارٍ التصدير...' : 'تصدير PDF'}
          </Button>
          <Button type="button" variant="outline" onClick={() => folderMutation.mutate()} disabled={folderMutation.isPending}>
            <FolderOpen className="h-4 w-4" />
            فتح مجلد التقارير
          </Button>
        </CardContent>
      </Card>

      {folderMessage && <p className="text-xs text-muted-foreground">{folderMessage}</p>}

      <p className="text-xs text-muted-foreground">
        يُولّد النظام تلقائياً تقارير يومية وأسبوعية وشهرية وسنوية (Excel + PDF) داخل مجلد Reports بجانب البرنامج.
      </p>

      {report && (
        <p className="text-sm text-muted-foreground">
          تقرير {report.periodLabel} من {formatDateTime(report.start)} إلى {formatDateTime(report.end)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {STAT_ITEMS.map(({ key, label }) => (
          <Card key={key}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              {isLoading || !report ? (
                <Skeleton className="mt-2 h-7 w-20" />
              ) : (
                <p className="mt-1 text-xl font-bold">
                  {key === 'invoiceCount' ? report[key].toLocaleString('ar-MA') : formatCurrency(report[key])}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">أفضل المنتجات مبيعاً</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton className="h-32 w-full" />}
            {report && report.topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد بيانات لهذه الفترة.</p>
            )}
            {report && report.topProducts.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-muted-foreground">
                    <th className="py-2 font-medium">المنتج</th>
                    <th className="py-2 font-medium">الكمية</th>
                    <th className="py-2 font-medium">الإيراد</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.name} className="border-b border-border last:border-0">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.qty}</td>
                      <td className="py-2">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">أقل المنتجات مبيعاً</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton className="h-32 w-full" />}
            {report && report.leastProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد بيانات لهذه الفترة.</p>
            )}
            {report && report.leastProducts.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-muted-foreground">
                    <th className="py-2 font-medium">المنتج</th>
                    <th className="py-2 font-medium">الكمية</th>
                    <th className="py-2 font-medium">الإيراد</th>
                  </tr>
                </thead>
                <tbody>
                  {report.leastProducts.map((p) => (
                    <tr key={p.name} className="border-b border-border last:border-0">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.qty}</td>
                      <td className="py-2">{formatCurrency(p.revenue)}</td>
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
          <CardTitle className="text-base font-semibold text-foreground">تصدير إلى Excel</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => exportSalesExcel()}>
            <FileSpreadsheet className="h-4 w-4" />
            المبيعات والأرباح
          </Button>
          <Button type="button" variant="outline" onClick={() => exportProductsExcel()}>
            <FileSpreadsheet className="h-4 w-4" />
            المنتجات والمخزون
          </Button>
          <Button type="button" variant="outline" onClick={() => exportCustomersExcel()}>
            <FileSpreadsheet className="h-4 w-4" />
            الزبائن
          </Button>
          <Button type="button" variant="outline" onClick={() => exportSuppliersExcel()}>
            <FileSpreadsheet className="h-4 w-4" />
            الموردون
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
