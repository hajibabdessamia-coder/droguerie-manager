import { apiClient } from './api-client';
import type { InvoiceType, PaymentMethod, PriceType, SaleDetail } from '@/types';

export interface SaleItemInput {
  productId: string;
  quantity: number;
  priceType: PriceType;
  customPrice?: number;
}

export interface CreateSaleInput {
  customerId?: string;
  invoiceType: InvoiceType;
  paymentMethod: PaymentMethod;
  discount: number;
  taxRate: number;
  amountPaid: number;
  overrideToken?: string;
  items: SaleItemInput[];
}

export async function createSale(input: CreateSaleInput): Promise<SaleDetail> {
  const { data } = await apiClient.post<SaleDetail>('/sales', input);
  return data;
}

export async function fetchSale(id: string): Promise<SaleDetail> {
  const { data } = await apiClient.get<SaleDetail>(`/sales/${id}`);
  return data;
}

export async function fetchSales(): Promise<SaleDetail[]> {
  const { data } = await apiClient.get<SaleDetail[]>('/sales');
  return data;
}

export interface UpdateSaleInput {
  invoiceType?: InvoiceType;
  paymentMethod?: PaymentMethod;
  discount?: number;
  taxRate?: number;
  amountPaid?: number;
}

export async function updateSale(id: string, input: UpdateSaleInput): Promise<SaleDetail> {
  const { data } = await apiClient.patch<SaleDetail>(`/sales/${id}`, input);
  return data;
}

export async function deleteSale(id: string): Promise<void> {
  await apiClient.delete(`/sales/${id}`);
}

export async function downloadSaleInvoicePdf(id: string, invoiceNumber: string): Promise<void> {
  const response = await apiClient.get(`/sales/${id}/pdf`, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `invoice-${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
