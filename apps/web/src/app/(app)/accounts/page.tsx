import { Suspense } from 'react';
import { AccountsManager } from '@/components/accounts-manager';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function AccountsPage(): React.JSX.Element {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountsManager />
    </Suspense>
  );
}
