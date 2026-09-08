import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { SiteHeader } from '@/components/site-header';

export default function AppLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <AuthGuard>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl p-6">{children}</main>
    </AuthGuard>
  );
}
