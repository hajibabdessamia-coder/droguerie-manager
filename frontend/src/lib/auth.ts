import { apiClient } from './api-client';

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
