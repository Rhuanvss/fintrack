'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Paginated, Transaction } from '@fintrack/shared';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { createTransaction, listTransactions, removeTransaction } from '@/lib/transactions';
import type { CreateTransactionInput, TransactionFilters } from '@/lib/transactions';

const PAGE_SIZE = 20;

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function TransactionsManager(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: PAGE_SIZE });
  const [form, setForm] = useState({ type: 'EXPENSE', amount: '', date: new Date().toISOString().slice(0, 10), description: '', accountId: '', categoryId: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const queryKey = ['transactions', filters];
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => listTransactions(filters),
  });

  const hasActiveFilters = [filters.q, filters.from, filters.to, filters.accountId, filters.categoryId].some((v) => !!v);
  const isFirstPage = (filters.page ?? 1) <= 1;

  const createMutation = useMutation({
    mutationFn: (input: CreateTransactionInput) => createTransaction(input),
    onMutate: async (input) => {
      setFormError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Paginated<Transaction>>(queryKey);
      if (!hasActiveFilters && isFirstPage) {
        const optimistic: Transaction = {
          id: `temp-${Date.now()}`,
          type: input.type,
          amount: String(input.amount),
          date: new Date(input.date).toISOString(),
          description: input.description,
          accountId: input.accountId,
          categoryId: input.categoryId ?? null,
          userId: '',
          transferId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<Paginated<Transaction>>(queryKey, (old) =>
          old ? { ...old, items: [optimistic, ...old.items].slice(0, PAGE_SIZE), total: old.total + 1 } : old,
        );
      }
      return { previous };
    },
    onError: (err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setFormError(err instanceof ApiError ? err.message : 'Falha ao criar transação.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeTransaction(id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  function setFilter(key: keyof TransactionFilters, value: string): void {
    setFilters((f) => ({ ...f, page: 1, [key]: value === '' ? undefined : value }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await createMutation.mutateAsync({
      type: form.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
      amount: Number(form.amount),
      date: new Date(form.date).toISOString(),
      description: form.description.trim(),
      accountId: form.accountId.trim(),
      ...(form.categoryId.trim() ? { categoryId: form.categoryId.trim() } : {}),
    });
    setForm((f) => ({ ...f, amount: '', description: '' }));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Transações</h1>

      <div className="grid gap-2 rounded-lg border p-4 sm:grid-cols-3" aria-label="Filtros">
        <input aria-label="Buscar" placeholder="Buscar descrição…" value={filters.q ?? ''} onChange={(e) => setFilter('q', e.target.value)} className={inputClass} />
        <input aria-label="De" type="date" value={filters.from ?? ''} onChange={(e) => setFilter('from', e.target.value)} className={inputClass} />
        <input aria-label="Até" type="date" value={filters.to ?? ''} onChange={(e) => setFilter('to', e.target.value)} className={inputClass} />
        <input aria-label="Conta" placeholder="accountId" value={filters.accountId ?? ''} onChange={(e) => setFilter('accountId', e.target.value)} className={inputClass} />
        <input aria-label="Categoria" placeholder="categoryId" value={filters.categoryId ?? ''} onChange={(e) => setFilter('categoryId', e.target.value)} className={inputClass} />
      </div>

      <form onSubmit={(e) => void handleCreate(e)} className="grid gap-2 rounded-lg border p-4 sm:grid-cols-3" aria-label="Nova transação">
        <label className="block space-y-1 text-sm font-medium">
          Tipo
          <select aria-label="Tipo" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputClass}>
            <option value="EXPENSE">Despesa</option>
            <option value="INCOME">Receita</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Valor
          <input aria-label="Valor" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Data
          <input aria-label="Data" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium sm:col-span-2">
          Descrição
          <input aria-label="Descrição" required maxLength={255} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Conta (ID)
          <input aria-label="Conta (ID)" required value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} className={inputClass} />
        </label>
        {formError ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-3">
            {formError}
          </p>
        ) : null}
        <div className="sm:col-span-3">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Salvando…' : 'Adicionar'}
          </Button>
        </div>
      </form>

      {isPending ? (
        <div className="space-y-2" aria-label="Carregando transações">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : isError ? (
        <ErrorState message={error instanceof ApiError ? error.message : 'Falha ao carregar.'} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Nenhuma transação" hint="Ajuste os filtros ou adicione a primeira." />
      ) : (
        <>
          <ul className="divide-y rounded-lg border" aria-label="Lista de transações">
            {data.items.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.type} · {Number(tx.amount).toFixed(2)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" aria-label={`Excluir ${tx.description}`} disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(tx.id)}>
                  Excluir
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Página {data.page} · {data.total} item(ns)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={!data.hasNext} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
