import type { Paginated, Transaction } from '@fintrack/shared';
import { apiFetch } from './api';

export interface TransactionFilters {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  categoryId?: string;
  accountId?: string;
  q?: string;
}

export interface CreateTransactionInput {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  date: string;
  description: string;
  accountId: string;
  categoryId?: string;
}

function toQuery(params: TransactionFilters): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listTransactions(params: TransactionFilters): Promise<Paginated<Transaction>> {
  return apiFetch<Paginated<Transaction>>(`/transactions${toQuery(params)}`);
}

export function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  return apiFetch<Transaction>('/transactions', { method: 'POST', body: input });
}

export function removeTransaction(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/transactions/${id}`, { method: 'DELETE' });
}
