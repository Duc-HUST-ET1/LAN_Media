import { useCallback, useEffect, useState } from 'react';
import { AuthApi, type AuthUser } from '../api/AuthApi';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await AuthApi.getCurrentUser());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    const authenticatedUser = await AuthApi.login(identifier, password);
    setUser(authenticatedUser);
  }, []);

  const register = useCallback(async (input: { username: string; email: string; displayName: string; password: string }) => {
    const authenticatedUser = await AuthApi.register(input);
    setUser(authenticatedUser);
  }, []);

  const logout = useCallback(async () => {
    await AuthApi.logout();
    setUser(null);
  }, []);

  return { user, loading, login, register, logout };
}
