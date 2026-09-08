import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from './auth-guard';
import { useAuth } from '@/lib/auth';
import type { AuthStatus } from '@/lib/auth';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

function mockStatus(status: AuthStatus): void {
  vi.mocked(useAuth).mockReturnValue({ status, user: null, login: async () => {}, register: async () => {}, logout: async () => {} });
}

describe('AuthGuard - task 4.5', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it('protege /dashboard sem token redirecionando para /login', () => {
    mockStatus('unauthenticated');
    render(
      <AuthGuard>
        <span>conteudo secreto</span>
      </AuthGuard>,
    );
    expect(replaceMock).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('conteudo secreto')).toBeNull();
  });

  it('renderiza filhos quando autenticado e nao redireciona', () => {
    mockStatus('authenticated');
    render(
      <AuthGuard>
        <span>conteudo secreto</span>
      </AuthGuard>,
    );
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.getByText('conteudo secreto')).not.toBeNull();
  });

  it('exibe skeleton durante loading sem redirecionar', () => {
    mockStatus('loading');
    render(
      <AuthGuard>
        <span>conteudo secreto</span>
      </AuthGuard>,
    );
    expect(screen.getByLabelText('Carregando')).not.toBeNull();
    expect(screen.queryByText('conteudo secreto')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
