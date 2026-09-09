import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardShell } from './dashboard-shell';
import { listBudgets } from '@/lib/budgets';
import { fetchBalances, fetchByCategory, fetchEvolution, fetchSummary } from '@/lib/reports';

vi.mock('@/lib/reports', () => ({
  fetchBalances: vi.fn(),
  fetchSummary: vi.fn(),
  fetchByCategory: vi.fn(),
  fetchEvolution: vi.fn(),
}));

vi.mock('@/lib/budgets', () => ({
  listBudgets: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function seed(): void {
  vi.mocked(fetchBalances).mockResolvedValue([
    { accountId: 'acc_1', accountName: 'Carteira', balance: 600 },
    { accountId: 'acc_2', accountName: 'Banco', balance: 300 },
  ]);
  vi.mocked(fetchSummary).mockResolvedValue({ totalIncome: 1000, totalExpense: 400, balance: 600 });
  vi.mocked(fetchByCategory).mockResolvedValue([
    { categoryId: 'cat_1', categoryName: 'Alimentacao', total: 400, percent: 100 },
  ]);
  vi.mocked(fetchEvolution).mockResolvedValue([
    { month: 8, year: 2026, income: 1000, expense: 400, balance: 600 },
  ]);
  vi.mocked(listBudgets).mockResolvedValue([
    { id: 'bud_1', userId: 'user_1', categoryId: 'cat_1', month: 8, year: 2026, amount: '500', spent: 250, percentUsed: 50, createdAt: '', updatedAt: '', category: undefined as never },
  ]);
}

describe('DashboardShell - task 4.9', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza cards, pizza por categoria e barras de evolucao', async () => {
    seed();
    render(<DashboardShell />, { wrapper });

    expect(await screen.findByText('900.00')).not.toBeNull();
    expect(screen.getByText('Alimentacao')).not.toBeNull();
    expect(screen.getByText('08/2026')).not.toBeNull();
    expect(screen.getByText('250.00 / 500.00 (50%)')).not.toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Uso 50%' })).not.toBeNull();
  });

  it('troca de mes refaz as queries com o novo periodo', async () => {
    seed();
    render(<DashboardShell />, { wrapper });
    await screen.findByText('900.00');

    expect(fetchSummary).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('De (mês)'), { target: { value: '2026-08' } });

    await screen.findByText('900.00');
    const calls = vi.mocked(fetchSummary).mock.calls.map((c) => c[0]);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[calls.length - 1]).toBe('2026-08-01');
    const evoCalls = vi.mocked(fetchEvolution).mock.calls.map((c) => c[0]);
    expect(evoCalls[evoCalls.length - 1]).toBe('2026-08-01');
  });
});
