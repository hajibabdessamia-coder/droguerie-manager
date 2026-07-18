import { apiClient } from './api-client';
import type { Manufacturer } from '@/types';

export async function fetchManufacturers(): Promise<Manufacturer[]> {
  const { data } = await apiClient.get<Manufacturer[]>('/manufacturers');
  return data;
}

export async function createManufacturer(name: string): Promise<Manufacturer> {
  const { data } = await apiClient.post<Manufacturer>('/manufacturers', { name });
  return data;
}
