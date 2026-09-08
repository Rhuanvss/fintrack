'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, apiFetch, getAccessToken, setAccessToken } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function refreshSession(): Promise<AuthUser | null> {
  try {
    const data = await apiFetch<{ accessToken: string }>('/auth/refresh', { method: 'POST' });
    setAccessToken(data.accessToken);
    return fetchMe();
  } catch {
    setAccessToken(null);
    return null;
  }
}

function fetchMe(): Promise<AuthUser | null> {
  // Token válido mas sem rota /me: decodifica o payload do JWT para exibir o usuário.
  const token = getAccessToken();
  if (!token) return Promise.resolve(null);
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { sub?: string; email?: string; role?: string };
    if (!payload.sub || !payload.email) return Promise.resolve(null);
    return Promise.resolve({
      id: payload.sub,
      name: payload.email.split('@')[0] ?? payload.email,
      email: payload.email,
      role: payload.role ?? 'USER',
    });
  } catch {
    return Promise.resolve(null);
  }
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot(): Promise<void> {
      const current = getAccessToken() ? await fetchMe() : await refreshSession();
      if (cancelled) return;
      setUser(current);
      setStatus(current ? 'authenticated' : 'unauthenticated');
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: AuthUser; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await apiFetch<{ user: AuthUser; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(() => ({ status, user, login, register, logout }), [status, user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
