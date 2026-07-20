import { apiClient } from './api-client';
import type { Backup } from '@/types';

export async function fetchBackups(): Promise<Backup[]> {
  const { data } = await apiClient.get<Backup[]>('/backups');
  return data;
}

export async function createBackup(): Promise<Backup> {
  const { data } = await apiClient.post<Backup>('/backups');
  return data;
}

export async function restoreBackup(id: string): Promise<{ ok: boolean; requiresRestart: boolean }> {
  const { data } = await apiClient.post(`/backups/${id}/restore`);
  return data;
}

export async function deleteBackup(id: string): Promise<{ ok: boolean }> {
  const { data } = await apiClient.delete(`/backups/${id}`);
  return data;
}

export async function openBackupsFolder(): Promise<{ ok: boolean; path: string; opened: boolean }> {
  const { data } = await apiClient.get('/backups/open-folder');
  return data;
}
