import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, TOKEN_KEY } from '../lib/api';
import type { Me, ModuleKey } from '../lib/types';

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** Permisos derivados */
  isSuper: boolean;
  isCompanyAdmin: boolean;
  leaderAreaIds: string[];
  isLeader: boolean;
  /** Gestiona solicitudes: administrador o miembro de un área (los demás solo radican y consultan las suyas) */
  hasPanel: boolean;
  /** ¿El superadministrador dejó activo este módulo para su empresa? */
  hasModule: (key: ModuleKey) => boolean;
  /** Al iniciar sesión va a la intranet (true) o directo al panel (false) */
  landsOnIntranet: boolean;
}

const Ctx = createContext<AuthState>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get<Me>('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; user: Me }>('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    location.href = '/login';
  }, []);

  const value = useMemo<AuthState>(() => {
    const leaderAreaIds = user?.memberships.filter((m) => m.role === 'LEADER').map((m) => m.area.id) || [];
    const isSuper = user?.role === 'SUPER_ADMIN';
    const isCompanyAdmin = user?.role === 'COMPANY_ADMIN';
    const modules = user?.settings?.modules;
    const hasModule = (key: ModuleKey) => modules?.[key] !== false;
    return {
      user,
      loading,
      login,
      logout,
      refresh,
      isSuper,
      isCompanyAdmin,
      leaderAreaIds,
      isLeader: isSuper || leaderAreaIds.length > 0,
      hasPanel: isSuper || isCompanyAdmin || (user?.memberships.length || 0) > 0,
      hasModule,
      landsOnIntranet: !!user?.company && hasModule('intranet') && user?.settings?.showIntranetOnLogin !== false,
    };
  }, [user, loading, login, logout, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
