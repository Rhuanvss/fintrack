import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Transaction } from '@fintrack/shared';
import { TransactionsManager } from './transactions-manager';
import { createTransaction, listTransactions } from '@/lib/transactions';

vi.mock('@/lib/transactions', () => ({
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
  removeTransaction: vi.fn(),
}));

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_1',
    type: 'EXPENSE',
    amount: '49.90',
    date: '2026-08-15T00:00:00.000Z',
    description: 'Mercado',
    accountId: 'acc_1',
    categoryId: null,
    userId: 'user_1',
    transferId: null,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('TransactionsManager - task 4.6', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista transacoes iniciais', async () => {
    vi.mocked(listTransactions).mockResolvedValue({ items: [tx()], total: 1, page: 1, limit: 20, hasNext: false });

    render(<TransactionsManager />, { wrapper });

    expect(await screen.findByText('Mercado')).not.toBeNull();
    expect(listTransactions).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('filtro q atualiza a query', async () => {
    vi.mocked(listTransactions).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, hasNext: false });

    render(<TransactionsManager />, { wrapper });
    await screen.findByText('Nenhuma transação');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'mercado' } });

    await waitFor(() => {
      expect(listTransactions).toHaveBeenCalledWith({ page: 1, limit: 20, q: 'mercado' });
    });
  });

  it('criar transacao atualiza a lista sem reload (optimistic)', async () => {
    vi.mocked(listTransactions).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, hasNext: false });
    let resolveCreate!: (value: Transaction) => void;
    vi.mocked(createTransaction).mockImplementation(
      () => new Promise<Transaction>((resolve) => { resolveCreate = resolve; }),
    );

    render(<TransactionsManager />, { wrapper });
    await screen.findByText('Nenhuma transação');

    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '49.9' } });
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Mercado' } });
    fireEvent.change(screen.getByLabelText('Conta (ID)'), { target: { value: 'acc_1' } });
    fireEvent.submit(screen.getByLabelText('Nova transação'));

    // Aparece na hora, antes da API responder (optimistic, sem reload).
    expect(await screen.findByText('Mercado')).not.toBeNull();
    expect(createTransaction).toHaveBeenCalledTimes(1);

    resolveCreate(tx({ id: 'tx_9', description: 'Mercado' }));
    vi.mocked(listTransactions).mockResolvedValue({ items: [tx({ id: 'tx_9' })], total: 1, page: 1, limit: 20, hasNext: false });

    await waitFor(() => {
      expect(screen.getByText('Mercado')).not.toBeNull();
    });
  });

  it('pula optimistic quando há filtro ativo (evita item fora do filtro)', async () => {
    vi.mocked(listTransactions).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, hasNext: false });
    let resolveCreate!: (value: Transaction) => void;
    vi.mocked(createTransaction).mockImplementation(
      () => new Promise<Transaction>((resolve) => { resolveCreate = resolve; }),
    );

    render(<TransactionsManager />, { wrapper });
    await screen.findByText('Nenhuma transação');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'aluguel' } });
    await waitFor(() => {
      expect(listTransactions).toHaveBeenCalledWith({ page: 1, limit: 20, q: 'aluguel' });
    });

    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '49.9' } });
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Mercado' } });
    fireEvent.change(screen.getByLabelText('Conta (ID)'), { target: { value: 'acc_1' } });
    fireEvent.submit(screen.getByLabelText('Nova transação'));

    await waitFor(() => {
      expect(createTransaction).toHaveBeenCalledTimes(1);
    });
    // Sem optimistic sob filtro: nada aparece antes da API responder.
    expect(screen.queryByText('Mercado')).toBeNull();

    resolveCreate(tx({ id: 'tx_9' }));
    vi.mocked(listTransactions).mockResolvedValue({ items: [tx({ id: 'tx_9' })], total: 1, page: 1, limit: 20, hasNext: false });

    await waitFor(() => {
      expect(screen.getByText('Mercado')).not.toBeNull();
    });
  });

  it('botão Próxima busca a página 2', async () => {
    vi.mocked(listTransactions).mockResolvedValue({ items: [tx()], total: 25, page: 1, limit: 20, hasNext: true });

    render(<TransactionsManager />, { wrapper });
    await screen.findByText('Mercado');

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => {
      expect(listTransactions).toHaveBeenCalledWith({ page: 2, limit: 20 });
    });
  });
});
