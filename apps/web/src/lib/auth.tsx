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

export function parseJwtPayload(token: string): AuthUser | null {
  // Token válido mas sem rota /me: decodifica o payload do JWT para exibir o usuário.
  try {
    const segment = token.split('.')[1] ?? '';
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (segment.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { sub?: string; email?: string; role?: string; exp?: number };
    if (!payload.sub || !payload.email) return null;
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) return null;
    return {
      id: payload.sub,
      name: payload.email.split('@')[0] ?? payload.email,
      email: payload.email,
      role: payload.role ?? 'USER',
    };
  } catch {
    return null;
  }
}

function fetchMe(): Promise<AuthUser | null> {
  const token = getAccessToken();
  return Promise.resolve(token ? parseJwtPayload(token) : null);
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot(): Promise<void> {
      const stored = getAccessToken() ? await fetchMe() : null;
      const current = stored ?? (await refreshSession());
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
