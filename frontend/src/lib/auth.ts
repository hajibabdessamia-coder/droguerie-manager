import { apiClient } from './api-client';
import type { AuthUser } from '@/types';

export async function authorizeOverride(email: string, password: string): Promise<string> {
  const { data } = await apiClient.post<{ overrideToken: string }>('/auth/authorize-override', {
    email,
    password,
  });
  return data.overrideToken;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}

export async function changeEmail(currentPassword: string, newEmail: string): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>('/auth/change-email', { currentPassword, newEmail });
  return data;
}
