import type { Account, AccountType } from '@fintrack/shared';
import { apiFetch } from './api';

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  color?: string;
}

export function listAccounts(includeArchived = false): Promise<Account[]> {
  const qs = includeArchived ? '?includeArchived=true' : '';
  return apiFetch<Account[]>(`/accounts${qs}`);
}

export function createAccount(input: CreateAccountInput): Promise<Account> {
  return apiFetch<Account>('/accounts', { method: 'POST', body: input });
}

export function archiveAccount(id: string): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}/archive`, { method: 'PATCH' });
}
