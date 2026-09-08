import type { Category } from '@fintrack/shared';
import { apiFetch } from './api';

export interface CreateCategoryInput {
  name: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories');
}

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  return apiFetch<Category>('/categories', { method: 'POST', body: input });
}

export function removeCategory(id: string, reassignTo?: string): Promise<{ id: string }> {
  const qs = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : '';
  return apiFetch<{ id: string }>(`/categories/${id}${qs}`, { method: 'DELETE' });
}
