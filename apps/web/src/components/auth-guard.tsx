'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { AuthStatus } from '@/lib/auth';
import { PageSkeleton } from '@/components/ui/skeleton';

export function shouldRedirectToLogin(status: AuthStatus): boolean {
  return status === 'unauthenticated';
}

export function AuthGuard({ children }: { children: ReactNode }): React.JSX.Element | null {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (shouldRedirectToLogin(status)) router.replace('/login');
  }, [status, router]);

  if (status === 'loading') return <PageSkeleton />;
  if (shouldRedirectToLogin(status)) return null;
  return <>{children}</>;
}
