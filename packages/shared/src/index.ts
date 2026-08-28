/**
 * @fintrack/shared v0 - Tipos compartilhados entre API e Web
 * Contratos tipados que quebram build se divergirem.
 */

export type UserRole = 'USER' | 'ADMIN';

export type AccountType = 'CHECKING' | 'SAVINGS' | 'WALLET' | 'CARD';

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  color?: string | null;
  isArchived: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  /** Balance computed from transactions — not stored */
  balance?: number;
}

export interface Category {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  parentId?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  date: string;
  description: string;
  accountId: string;
  categoryId?: string | null;
  userId: string;
  transferId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  month: number;
  year: number;
  amount: string;
  spent?: number;
  percentUsed?: number;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ApiError {
  message: string;
  error?: string;
  statusCode: number;
}

export * from './schemas';

// Re-export placeholders for backward compat during migration
export type Placeholder = string;
export const sharedPlaceholder: Placeholder = 'fintrack shared placeholder';
