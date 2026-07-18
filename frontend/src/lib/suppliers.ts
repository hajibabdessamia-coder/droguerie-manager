import { apiClient } from './api-client';
import type { Supplier, SupplierDetail } from '@/types';

export async function fetchSuppliers(search?: string): Promise<Supplier[]> {
  const { data } = await apiClient.get<Supplier[]>('/suppliers', { params: { search: search || undefined } });
  return data;
}

export async function fetchSupplier(id: string): Promise<SupplierDetail> {
  const { data } = await apiClient.get<SupplierDetail>(`/suppliers/${id}`);
  return data;
}

export interface SupplierInput {
  name: string;
  phone?: string;
  address?: string;
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const { data } = await apiClient.post<Supplier>('/suppliers', input);
  return data;
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  const { data } = await apiClient.patch<Supplier>(`/suppliers/${id}`, input);
  return data;
}

export async function deleteSupplier(id: string): Promise<void> {
  await apiClient.delete(`/suppliers/${id}`);
}

export async function addSupplierPayment(id: string, amount: number, note?: string) {
  const { data } = await apiClient.post(`/suppliers/${id}/payments`, { amount, note });
  return data;
}
