import { apiClient } from './api-client';
import type { PurchaseDetail, PurchaseListItem } from '@/types';

export async function fetchPurchases(): Promise<PurchaseListItem[]> {
  const { data } = await apiClient.get<PurchaseListItem[]>('/purchases');
  return data;
}

export async function fetchPurchase(id: string): Promise<PurchaseDetail> {
  const { data } = await apiClient.get<PurchaseDetail>(`/purchases/${id}`);
  return data;
}

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  purchasePrice: number;
}

export interface PurchaseInput {
  supplierId: string;
  invoiceRef?: string;
  items: PurchaseItemInput[];
}

export async function createPurchase(input: PurchaseInput): Promise<PurchaseDetail> {
  const { data } = await apiClient.post<PurchaseDetail>('/purchases', input);
  return data;
}
