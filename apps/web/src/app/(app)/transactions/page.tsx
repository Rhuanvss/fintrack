import { Suspense } from 'react';
import { TransactionsManager } from '@/components/transactions-manager';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function TransactionsPage(): React.JSX.Element {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TransactionsManager />
    </Suspense>
  );
}
