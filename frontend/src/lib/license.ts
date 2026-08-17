import { apiClient } from './api-client';

export type LicenseState = 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'LICENSED' | 'LICENSE_EXPIRED' | 'LICENSE_INVALID';

export interface LicenseStatus {
  state: LicenseState;
  remainingDays?: number;
  deviceId: string;
  clockAnomalyDetected: boolean;
}

export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  const { data } = await apiClient.get<LicenseStatus>('/license/status');
  return data;
}

export async function activateLicense(licenseKey: string): Promise<LicenseStatus> {
  const { data } = await apiClient.post<LicenseStatus>('/license/activate', { licenseKey });
  return data;
}
