'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/transactions', label: 'Transações' },
  { href: '/accounts', label: 'Contas' },
  { href: '/categories', label: 'Categorias' },
];

export function SiteHeader(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
        <nav className="flex items-center gap-1" aria-label="Principal">
          <Link href="/dashboard" className="mr-3 text-lg font-bold tracking-tight">
            FinTrack
          </Link>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground',
                pathname === item.href && 'bg-muted text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user ? <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span> : null}
          <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
