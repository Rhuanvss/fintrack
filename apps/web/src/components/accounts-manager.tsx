'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Account, AccountType } from '@fintrack/shared';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { archiveAccount, createAccount, listAccounts } from '@/lib/accounts';
import type { CreateAccountInput } from '@/lib/accounts';

const ACCOUNT_TYPES: AccountType[] = ['CHECKING', 'SAVINGS', 'WALLET', 'CARD'];

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const QUERY_KEY = ['accounts'];

export function AccountsManager(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', type: 'WALLET' as AccountType });
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listAccounts(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onMutate: async (input) => {
      setFormError(null);
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Account[]>(QUERY_KEY);
      const optimistic: Account = {
        id: `temp-${Date.now()}`,
        name: input.name,
        type: input.type,
        color: null,
        isArchived: false,
        userId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        balance: 0,
      };
      queryClient.setQueryData<Account[]>(QUERY_KEY, (old) => (old ? [...old, optimistic] : [optimistic]));
      return { previous };
    },
    onError: (err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      setFormError(err instanceof ApiError ? err.message : 'Falha ao criar conta.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveAccount(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Account[]>(QUERY_KEY);
      queryClient.setQueryData<Account[]>(QUERY_KEY, (old) => (old ?? []).filter((a) => a.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await createMutation.mutateAsync({ name: form.name.trim(), type: form.type });
    setForm((f) => ({ ...f, name: '' }));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Contas</h1>

      <form onSubmit={(e) => void handleCreate(e)} className="grid gap-2 rounded-lg border p-4 sm:grid-cols-3" aria-label="Nova conta">
        <label className="block space-y-1 text-sm font-medium sm:col-span-2">
          Nome
          <input aria-label="Nome" required maxLength={100} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Tipo
          <select aria-label="Tipo" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType }))} className={inputClass}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
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
        <div className="space-y-2" aria-label="Carregando contas">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : isError ? (
        <ErrorState message={error instanceof ApiError ? error.message : 'Falha ao carregar.'} onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nenhuma conta" hint="Adicione sua primeira conta acima." />
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Lista de contas">
          {data.map((acc) => (
            <li key={acc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{acc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {acc.type} · Saldo {Number(acc.balance ?? 0).toFixed(2)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Arquivar ${acc.name}`}
                disabled={archiveMutation.isPending}
                onClick={() => archiveMutation.mutate(acc.id)}
              >
                Arquivar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
