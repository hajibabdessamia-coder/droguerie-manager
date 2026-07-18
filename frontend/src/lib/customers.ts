import { apiClient } from './api-client';
import type { Customer, CustomerDetail, CustomerType } from '@/types';

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  const { data } = await apiClient.get<Customer[]>('/customers', { params: { search: search || undefined } });
  return data;
}

export async function fetchCustomer(id: string): Promise<CustomerDetail> {
  const { data } = await apiClient.get<CustomerDetail>(`/customers/${id}`);
  return data;
}

export interface CustomerInput {
  name: string;
  phone?: string;
  address?: string;
  type: CustomerType;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data } = await apiClient.post<Customer>('/customers', input);
  return data;
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const { data } = await apiClient.patch<Customer>(`/customers/${id}`, input);
  return data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiClient.delete(`/customers/${id}`);
}

export async function addCustomerPayment(id: string, amount: number, note?: string) {
  const { data } = await apiClient.post(`/customers/${id}/payments`, { amount, note });
  return data;
}
