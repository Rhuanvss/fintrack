import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardShell } from './dashboard-shell';
import { listBudgets } from '@/lib/budgets';
import { fetchBalances, fetchSummary } from '@/lib/reports';

vi.mock('@/lib/reports', () => ({
  fetchBalances: vi.fn(),
  fetchSummary: vi.fn(),
}));

vi.mock('@/lib/budgets', () => ({
  listBudgets: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('DashboardShell - task 4.8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza cards de saldo, resumo e budgets com percentUsed', async () => {
    vi.mocked(fetchBalances).mockResolvedValue([
      { accountId: 'acc_1', accountName: 'Carteira', balance: 600 },
      { accountId: 'acc_2', accountName: 'Banco', balance: 300 },
    ]);
    vi.mocked(fetchSummary).mockResolvedValue({ totalIncome: 1000, totalExpense: 400, balance: 600 });
    vi.mocked(listBudgets).mockResolvedValue([
      { id: 'bud_1', userId: 'user_1', categoryId: 'cat_1', month: 8, year: 2026, amount: '500', spent: 250, percentUsed: 50, createdAt: '', updatedAt: '', category: undefined as never },
    ]);

    render(<DashboardShell />, { wrapper });

    expect(await screen.findByText('900.00')).not.toBeNull();
    expect(screen.getByText('1000.00')).not.toBeNull();
    expect(screen.getByText('400.00')).not.toBeNull();
    expect(screen.getByText(/Balanço 600\.00/)).not.toBeNull();
    expect(screen.getByText('250.00 / 500.00 (50%)')).not.toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Uso 50%' })).not.toBeNull();
  });
});
