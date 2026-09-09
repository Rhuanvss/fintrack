'use client';

import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { listBudgets } from '@/lib/budgets';
import { fetchBalances, fetchByCategory, fetchEvolution, fetchSummary } from '@/lib/reports';

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function defaultRange(now = new Date()): { fromMonth: string; toMonth: string } {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return { fromMonth: `${now.getFullYear()}-01`, toMonth: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` };
}

function parseMonth(monthStr: string): { month: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

function monthBounds(monthStr: string, fallback: { month: number; year: number }): { from: string; to: string; month: number; year: number } {
  const parsed = parseMonth(monthStr) ?? fallback;
  const { month, year } = parsed;
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}`, month, year };
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
const inputClass = 'rounded-md border border-input bg-background px-3 py-2 text-sm';

export function DashboardShell(): React.JSX.Element {
  const [months, setMonths] = useState(defaultRange);
  const now = new Date();
  const fallback = { month: now.getMonth() + 1, year: now.getFullYear() };
  const from = monthBounds(months.fromMonth, fallback);
  const to = monthBounds(months.toMonth, fallback);

  const [balancesQ, summaryQ, byCategoryQ, evolutionQ, budgetsQ] = useQueries({
    queries: [
      { queryKey: ['balances'], queryFn: () => fetchBalances() },
      { queryKey: ['summary', from.from, to.to], queryFn: () => fetchSummary(from.from, to.to) },
      { queryKey: ['by-category', from.from, to.to], queryFn: () => fetchByCategory(from.from, to.to) },
      { queryKey: ['evolution', from.from, to.to], queryFn: () => fetchEvolution(from.from, to.to) },
      { queryKey: ['budgets', to.month, to.year], queryFn: () => listBudgets(to.month, to.year) },
    ],
  });
  const queries = [balancesQ, summaryQ, byCategoryQ, evolutionQ, budgetsQ];

  if (queries.some((q) => q.isPending)) {
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

  const error = queries.find((q) => q.isError)?.error;
  const loaded = balancesQ.data && summaryQ.data && byCategoryQ.data && evolutionQ.data && budgetsQ.data;
  if (error || !loaded) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <ErrorState
          message={error instanceof ApiError ? error.message : 'Falha ao carregar.'}
          onRetry={() => {
            for (const q of queries) void q.refetch();
          }}
        />
      </div>
    );
  }

  const totalBalance = balancesQ.data.reduce((acc, b) => acc + b.balance, 0);
  const summary = summaryQ.data;
  const byCategory = byCategoryQ.data;
  const evolution = evolutionQ.data.map((e) => ({ ...e, label: `${String(e.month).padStart(2, '0')}/${e.year}` }));
  const budgets = budgetsQ.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2" aria-label="Período">
          <label className="text-sm text-muted-foreground">
            De <input aria-label="De (mês)" type="month" value={months.fromMonth} onChange={(e) => setMonths((m) => ({ ...m, fromMonth: e.target.value }))} className={inputClass} />
          </label>
          <label className="text-sm text-muted-foreground">
            Até <input aria-label="Até (mês)" type="month" value={months.toMonth} onChange={(e) => setMonths((m) => ({ ...m, toMonth: e.target.value }))} className={inputClass} />
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3" aria-label="Resumo do período">
        <Card title="Saldo total" value={money(totalBalance)} hint={`${balancesQ.data.length} conta(s)`} />
        <Card title="Receitas" value={money(summary.totalIncome)} />
        <Card title="Despesas" value={money(summary.totalExpense)} hint={`Balanço ${money(summary.balance)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-lg border p-4" aria-label="Gastos por categoria">
          <h2 className="text-lg font-semibold">Gastos por categoria</h2>
          {byCategory.length === 0 ? (
            <EmptyState title="Sem gastos no período" />
          ) : (
            <div className="w-full overflow-x-auto">
              <PieChart width={380} height={280}>
                <Pie data={byCategory} dataKey="total" nameKey="categoryName" cx="50%" cy="50%" outerRadius={100} label>
                  {byCategory.map((entry, i) => (
                    <Cell key={entry.categoryId ?? 'null'} fill={PIE_COLORS[i % PIE_COLORS.length] ?? '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                <Legend />
              </PieChart>
            </div>
          )}
        </section>

        <section className="space-y-2 rounded-lg border p-4" aria-label="Evolução mensal">
          <h2 className="text-lg font-semibold">Evolução mensal</h2>
          {evolution.length === 0 ? (
            <EmptyState title="Sem dados no período" />
          ) : (
            <div className="w-full overflow-x-auto">
              <BarChart width={420} height={280} data={evolution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                <Legend />
                <Bar dataKey="income" name="Receitas" fill="#22c55e" />
                <Bar dataKey="expense" name="Despesas" fill="#ef4444" />
              </BarChart>
            </div>
          )}
        </section>
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
