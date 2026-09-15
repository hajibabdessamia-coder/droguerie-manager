import { apiClient } from './api-client';
import type { Product } from '@/types';

export interface ProductQuery {
  search?: string;
  categoryId?: string;
  manufacturerId?: string;
  lowStock?: boolean;
}

export async function fetchProducts(query: ProductQuery = {}): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>('/products', {
    params: {
      search: query.search || undefined,
      categoryId: query.categoryId || undefined,
      manufacturerId: query.manufacturerId || undefined,
      lowStock: query.lowStock ? 'true' : undefined,
    },
  });
  return data;
}

export async function fetchProduct(id: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/products/${id}`);
  return data;
}

export interface ProductInput {
  name: string;
  imageUrl?: string;
  internalCode: string;
  barcode?: string;
  categoryId?: string;
  unitId?: string;
  manufacturerId?: string;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  quantity?: number;
  minStock: number;
  notes?: string;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data } = await apiClient.post<Product>('/products', input);
  return data;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const { data } = await apiClient.patch<Product>(`/products/${id}`, input);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/products/${id}`);
}

export async function adjustProductStock(id: string, delta: number, reason?: string): Promise<Product> {
  const { data } = await apiClient.patch<Product>(`/products/${id}/stock`, { delta, reason });
  return data;
}

export async function generateBarcode(): Promise<string> {
  const { data } = await apiClient.get<{ barcode: string }>('/products/generate-barcode');
  return data.barcode;
}

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<{ url: string }>('/uploads/product-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}
