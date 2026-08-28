import { Button } from '@/components/ui/button';
import type { Account, Paginated } from '@fintrack/shared';

const _typeCheck: Paginated<Account> = {
  items: [],
  total: 0,
  page: 1,
  limit: 20,
  hasNext: false,
};
void _typeCheck;

export default function HomePage(): React.ReactNode {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">FinTrack</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Controle financeiro pessoal — gerencie contas, transações e orçamentos.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button>Começar</Button>
          <Button variant="outline">Saiba mais</Button>
        </div>
      </div>
    </main>
  );
}
