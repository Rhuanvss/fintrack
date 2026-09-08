import { Suspense } from 'react';
import type { Account, Paginated } from '@fintrack/shared';
import { DashboardShell } from '@/components/dashboard-shell';
import { PageSkeleton } from '@/components/ui/skeleton';

const _typeCheck: Paginated<Account> = {
  items: [],
  total: 0,
  page: 1,
  limit: 20,
  hasNext: false,
};
void _typeCheck;

export default function DashboardPage(): React.JSX.Element {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardShell />
    </Suspense>
  );
}
