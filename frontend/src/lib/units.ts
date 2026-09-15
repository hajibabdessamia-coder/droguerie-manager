import { apiClient } from './api-client';
import type { Unit } from '@/types';

export async function fetchUnits(): Promise<Unit[]> {
  const { data } = await apiClient.get<Unit[]>('/units');
  return data;
}

export async function createUnit(name: string): Promise<Unit> {
  const { data } = await apiClient.post<Unit>('/units', { name });
  return data;
}

export async function updateUnit(id: string, name: string): Promise<Unit> {
  const { data } = await apiClient.patch<Unit>(`/units/${id}`, { name });
  return data;
}

export async function deleteUnit(id: string): Promise<void> {
  await apiClient.delete(`/units/${id}`);
}
