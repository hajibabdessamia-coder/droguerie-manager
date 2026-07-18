import { apiClient } from './api-client';
import type { ReportPeriod, ReportSummary } from '@/types';

export async function fetchReportSummary(period: ReportPeriod, date?: string): Promise<ReportSummary> {
  const { data } = await apiClient.get<ReportSummary>('/reports/summary', { params: { period, date } });
  return data;
}

async function downloadFile(url: string, params: Record<string, string | undefined>, filename: string) {
  const response = await apiClient.get(url, { params, responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export const exportSalesExcel = () => downloadFile('/reports/export/sales.xlsx', {}, 'sales.xlsx');
export const exportProductsExcel = () => downloadFile('/reports/export/products.xlsx', {}, 'products.xlsx');
export const exportCustomersExcel = () => downloadFile('/reports/export/customers.xlsx', {}, 'customers.xlsx');
export const exportSuppliersExcel = () => downloadFile('/reports/export/suppliers.xlsx', {}, 'suppliers.xlsx');
export const exportSummaryPdf = (period: ReportPeriod, date?: string) =>
  downloadFile('/reports/export/summary.pdf', { period, date }, `report-${period}.pdf`);

export async function openReportsFolder(): Promise<{ opened: boolean; path: string }> {
  const { data } = await apiClient.get('/reports/open-folder');
  return data;
}
