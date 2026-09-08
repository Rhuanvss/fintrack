import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Account } from '@fintrack/shared';
import { AccountsManager } from './accounts-manager';
import { archiveAccount, createAccount, listAccounts } from '@/lib/accounts';

vi.mock('@/lib/accounts', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  archiveAccount: vi.fn(),
}));

function acc(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_1',
    name: 'Carteira',
    type: 'WALLET',
    color: null,
    isArchived: false,
    userId: 'user_1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    balance: 600,
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('AccountsManager - task 4.7', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('criar conta atualiza a lista sem reload (optimistic)', async () => {
    vi.mocked(listAccounts).mockResolvedValue([]);
    let resolveCreate!: (value: Account) => void;
    vi.mocked(createAccount).mockImplementation(() => new Promise<Account>((resolve) => { resolveCreate = resolve; }));

    render(<AccountsManager />, { wrapper });
    await screen.findByText('Nenhuma conta');

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Banco' } });
    fireEvent.submit(screen.getByLabelText('Nova conta'));

    // Aparece na hora, antes da API responder (optimistic, sem reload).
    expect(await screen.findByText('Banco')).not.toBeNull();
    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(createAccount).toHaveBeenCalledWith({ name: 'Banco', type: 'WALLET' });

    resolveCreate(acc({ id: 'acc_9', name: 'Banco' }));
    vi.mocked(listAccounts).mockResolvedValue([acc({ id: 'acc_9', name: 'Banco' })]);

    await waitFor(() => {
      expect(screen.getByText('Banco')).not.toBeNull();
    });
  });

  it('arquivar conta some da listagem', async () => {
    vi.mocked(listAccounts).mockResolvedValue([acc()]);
    vi.mocked(archiveAccount).mockImplementation(() => Promise.resolve(acc({ isArchived: true })));
    vi.mocked(listAccounts).mockResolvedValueOnce([acc()]);

    render(<AccountsManager />, { wrapper });
    await screen.findByText('Carteira');

    vi.mocked(listAccounts).mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: 'Arquivar Carteira' }));

    expect(archiveAccount).toHaveBeenCalledWith('acc_1');
    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta')).not.toBeNull();
    });
    expect(screen.queryByText('Carteira')).toBeNull();
  });
});
