import { Suspense } from 'react';
import { CategoriesManager } from '@/components/categories-manager';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function CategoriesPage(): React.JSX.Element {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CategoriesManager />
    </Suspense>
  );
}
