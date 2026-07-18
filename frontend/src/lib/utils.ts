import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? Number(value) : value;
  return `${num.toLocaleString('ar-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.م.`;
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString('ar-MA', { dateStyle: 'short', timeStyle: 'short' });
}
