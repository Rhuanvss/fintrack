import type { Budget } from '@fintrack/shared';
import { apiFetch } from './api';

export function listBudgets(month: number, year: number): Promise<Budget[]> {
  const qs = new URLSearchParams({ month: String(month), year: String(year) }).toString();
  return apiFetch<Budget[]>(`/budgets?${qs}`);
}
