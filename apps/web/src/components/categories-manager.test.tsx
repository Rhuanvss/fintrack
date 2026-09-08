import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Category } from '@fintrack/shared';
import { CategoriesManager } from './categories-manager';
import { createCategory, listCategories, removeCategory } from '@/lib/categories';

vi.mock('@/lib/categories', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  removeCategory: vi.fn(),
}));

function cat(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat_1',
    name: 'Alimentacao',
    color: null,
    icon: null,
    parentId: null,
    userId: 'user_1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('CategoriesManager - task 4.8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('criar categoria atualiza a lista sem reload (optimistic)', async () => {
    vi.mocked(listCategories).mockResolvedValue([]);
    let resolveCreate!: (value: Category) => void;
    vi.mocked(createCategory).mockImplementation(() => new Promise<Category>((resolve) => { resolveCreate = resolve; }));

    render(<CategoriesManager />, { wrapper });
    await screen.findByText('Nenhuma categoria');

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Lazer' } });
    fireEvent.submit(screen.getByLabelText('Nova categoria'));

    const list = await screen.findByRole('list');
    expect(within(list).getByText('Lazer')).not.toBeNull();
    expect(createCategory).toHaveBeenCalledWith({ name: 'Lazer' });

    resolveCreate(cat({ id: 'cat_9', name: 'Lazer' }));
    vi.mocked(listCategories).mockResolvedValue([cat({ id: 'cat_9', name: 'Lazer' })]);

    await waitFor(() => {
      expect(within(screen.getByRole('list')).getByText('Lazer')).not.toBeNull();
    });
  });

  it('excluir categoria some da listagem', async () => {
    vi.mocked(listCategories).mockResolvedValue([cat()]);
    vi.mocked(removeCategory).mockImplementation(() => Promise.resolve({ id: 'cat_1' }));

    render(<CategoriesManager />, { wrapper });
    expect(within(await screen.findByRole('list')).getByText('Alimentacao')).not.toBeNull();

    vi.mocked(listCategories).mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Alimentacao' }));

    expect(removeCategory).toHaveBeenCalledWith('cat_1', undefined);
    await waitFor(() => {
      expect(screen.getByText('Nenhuma categoria')).not.toBeNull();
    });
  });
});
