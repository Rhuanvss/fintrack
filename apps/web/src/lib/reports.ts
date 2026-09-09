import { apiFetch } from './api';

export interface ReportsSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface AccountBalance {
  accountId: string;
  accountName: string;
  balance: number;
}

export interface CategoryExpense {
  categoryId: string | null;
  categoryName: string;
  total: number;
  percent: number;
}

export interface MonthlyEvolution {
  month: number;
  year: number;
  income: number;
  expense: number;
  balance: number;
}

export function fetchSummary(from: string, to: string): Promise<ReportsSummary> {
  const qs = new URLSearchParams({ from, to }).toString();
  return apiFetch<ReportsSummary>(`/reports/summary?${qs}`);
}

export function fetchBalances(): Promise<AccountBalance[]> {
  return apiFetch<AccountBalance[]>('/reports/balances');
}

export function fetchByCategory(from: string, to: string): Promise<CategoryExpense[]> {
  const qs = new URLSearchParams({ from, to }).toString();
  return apiFetch<CategoryExpense[]>(`/reports/by-category?${qs}`);
}

export function fetchEvolution(from: string, to: string): Promise<MonthlyEvolution[]> {
  const qs = new URLSearchParams({ from, to }).toString();
  return apiFetch<MonthlyEvolution[]>(`/reports/evolution?${qs}`);
}
