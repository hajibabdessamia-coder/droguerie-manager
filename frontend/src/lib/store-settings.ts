import { apiClient } from './api-client';
import type { StoreSettings } from '@/types';

export async function fetchStoreSettings(): Promise<StoreSettings> {
  const { data } = await apiClient.get<StoreSettings>('/store-settings');
  return data;
}

export interface StoreSettingsInput {
  name?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  ifNumber?: string;
  ice?: string;
  rc?: string;
  patente?: string;
  defaultTaxRate?: number;
}

export async function updateStoreSettings(input: StoreSettingsInput): Promise<StoreSettings> {
  const { data } = await apiClient.patch<StoreSettings>('/store-settings', input);
  return data;
}
