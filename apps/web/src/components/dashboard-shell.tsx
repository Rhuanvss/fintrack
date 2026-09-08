'use client';

import { useQueries } from '@tanstack/react-query';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { listBudgets } from '@/lib/budgets';
import { fetchBalances, fetchSummary } from '@/lib/reports';

function monthRange(now = new Date()): { from: string; to: string; month: number; year: number } {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(now.getDate())}`,
    month,
    year,
  };
}

function Card({ title, value, hint }: { title: string; value: string; hint?: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const money = (n: number): string => n.toFixed(2);

export function DashboardShell(): React.JSX.Element {
  const range = monthRange();
  const [balancesQ, summaryQ, budgetsQ] = useQueries({
    queries: [
      { queryKey: ['balances'], queryFn: () => fetchBalances() },
      { queryKey: ['summary', range.from, range.to], queryFn: () => fetchSummary(range.from, range.to) },
      { queryKey: ['budgets', range.month, range.year], queryFn: () => listBudgets(range.month, range.year) },
    ],
  });

  if (balancesQ.isPending || summaryQ.isPending || budgetsQ.isPending) {
    return (
      <div className="space-y-4" aria-label="Carregando dashboard">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const error = [balancesQ, summaryQ, budgetsQ].find((q) => q.isError)?.error;
  if (error || !balancesQ.data || !summaryQ.data || !budgetsQ.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <ErrorState
          message={error instanceof ApiError ? error.message : 'Falha ao carregar.'}
          onRetry={() => {
            void balancesQ.refetch();
            void summaryQ.refetch();
            void budgetsQ.refetch();
          }}
        />
      </div>
    );
  }

  const totalBalance = balancesQ.data.reduce((acc, b) => acc + b.balance, 0);
  const summary = summaryQ.data;
  const budgets = budgetsQ.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3" aria-label="Resumo do mês">
        <Card title="Saldo total" value={money(totalBalance)} hint={`${balancesQ.data.length} conta(s)`} />
        <Card title="Receitas (mês)" value={money(summary.totalIncome)} />
        <Card title="Despesas (mês)" value={money(summary.totalExpense)} hint={`Balanço ${money(summary.balance)}`} />
      </div>

      <section className="space-y-3" aria-label="Orçamentos do mês">
        <h2 className="text-lg font-semibold">Orçamentos do mês</h2>
        {budgets.length === 0 ? (
          <EmptyState title="Nenhum orçamento" hint="Defina limites mensais por categoria via API." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {budgets.map((b) => {
              const percent = Math.min(100, Math.max(0, b.percentUsed ?? 0));
              return (
                <li key={b.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{b.category?.name ?? 'Categoria'}</p>
                    <p className="text-xs text-muted-foreground">
                      {money(b.spent ?? 0)} / {money(Number(b.amount))} ({percent.toFixed(0)}%)
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label={`Uso ${percent.toFixed(0)}%`}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
