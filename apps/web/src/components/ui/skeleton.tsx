import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function PageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-6" aria-label="Carregando">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
