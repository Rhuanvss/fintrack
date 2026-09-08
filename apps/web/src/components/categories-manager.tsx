'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Category } from '@fintrack/shared';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { createCategory, listCategories, removeCategory } from '@/lib/categories';
import type { CreateCategoryInput } from '@/lib/categories';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const QUERY_KEY = ['categories'];

export function CategoriesManager(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', color: '', parentId: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [reassign, setReassign] = useState<Record<string, string>>({});

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listCategories(),
  });

  const names = new Map((data ?? []).map((c) => [c.id, c.name]));

  const createMutation = useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(input),
    onMutate: async (input) => {
      setFormError(null);
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Category[]>(QUERY_KEY);
      const optimistic: Category = {
        id: `temp-${Date.now()}`,
        name: input.name,
        color: input.color ?? null,
        icon: null,
        parentId: input.parentId ?? null,
        userId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Category[]>(QUERY_KEY, (old) => (old ? [...old, optimistic] : [optimistic]));
      return { previous };
    },
    onError: (err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      setFormError(err instanceof ApiError ? err.message : 'Falha ao criar categoria.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) => removeCategory(id, reassignTo),
    onMutate: async ({ id }) => {
      setFormError(null);
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Category[]>(QUERY_KEY);
      queryClient.setQueryData<Category[]>(QUERY_KEY, (old) => (old ?? []).filter((c) => c.id !== id));
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      setFormError(err instanceof ApiError ? err.message : 'Falha ao excluir. Se houver transações, escolha outra categoria e tente com reatribuição.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await createMutation.mutateAsync({
      name: form.name.trim(),
      ...(form.color.trim() ? { color: form.color.trim() } : {}),
      ...(form.parentId ? { parentId: form.parentId } : {}),
    });
    setForm({ name: '', color: '', parentId: '' });
  }

  const roots = (data ?? []).filter((c) => !c.parentId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>

      <form onSubmit={(e) => void handleCreate(e)} className="grid gap-2 rounded-lg border p-4 sm:grid-cols-3" aria-label="Nova categoria">
        <label className="block space-y-1 text-sm font-medium">
          Nome
          <input aria-label="Nome" required maxLength={100} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Cor (hex)
          <input aria-label="Cor" placeholder="#22c55e" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Categoria pai
          <select aria-label="Categoria pai" value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))} className={inputClass}>
            <option value="">Nenhuma (raiz)</option>
            {roots.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
        <div className="space-y-2" aria-label="Carregando categorias">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : isError ? (
        <ErrorState message={error instanceof ApiError ? error.message : 'Falha ao carregar.'} onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nenhuma categoria" hint="Adicione sua primeira categoria acima." />
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Lista de categorias">
          {data.map((cat) => (
            <li key={cat.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {cat.parentId && names.get(cat.parentId) ? `${names.get(cat.parentId)} › ` : ''}
                  {cat.name}
                </p>
                <p className="text-xs text-muted-foreground">{cat.parentId ? 'Subcategoria' : 'Raiz'}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Reatribuir ${cat.name}`}
                  value={reassign[cat.id] ?? ''}
                  onChange={(e) => setReassign((r) => ({ ...r, [cat.id]: e.target.value }))}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value="">Excluir direto</option>
                  {(data ?? [])
                    .filter((c) => c.id !== cat.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Mover para {c.name}
                      </option>
                    ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Excluir ${cat.name}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    const target = reassign[cat.id];
                    deleteMutation.mutate(target ? { id: cat.id, reassignTo: target } : { id: cat.id });
                  }}
                >
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
