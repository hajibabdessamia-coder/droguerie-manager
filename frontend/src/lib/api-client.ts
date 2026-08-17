import axios from 'axios';
import { useAuthStore } from '@/store/auth-store';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    if (error.response?.data?.code === 'LICENSE_REQUIRED') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/activate') {
        window.location.href = '/activate';
      }
    }
    return Promise.reject(error);
  },
);
