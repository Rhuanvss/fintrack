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

export function fetchSummary(from: string, to: string): Promise<ReportsSummary> {
  const qs = new URLSearchParams({ from, to }).toString();
  return apiFetch<ReportsSummary>(`/reports/summary?${qs}`);
}

export function fetchBalances(): Promise<AccountBalance[]> {
  return apiFetch<AccountBalance[]>('/reports/balances');
}
