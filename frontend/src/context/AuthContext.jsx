import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, clearAuth, getAuth, onUnauthorized, saveAuth } from '../lib/api';

const AuthContext = createContext(null);

// Keeps the admin JWT in memory + localStorage. No server session exists (stateless API).
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getAuth());
  const navigate = useNavigate();

  const logout = useCallback(
    (reason) => {
      clearAuth();
      setAuth(null);
      if (reason === 'expired') {
        toast.info('Session expired', { description: 'Please sign in again to continue.' });
      }
      navigate('/admin/login', { replace: true });
    },
    [navigate],
  );

  // Any 401 from an admin API call logs out.
  useEffect(() => {
    onUnauthorized(() => logout('expired'));
    return () => onUnauthorized(null);
  }, [logout]);

  // Log out automatically when the token's expiry time arrives.
  useEffect(() => {
    if (!auth) return undefined;
    const ms = new Date(auth.expiresAt).getTime() - Date.now();
    const id = setTimeout(() => logout('expired'), Math.max(0, Math.min(ms, 2147483647)));
    return () => clearTimeout(id);
  }, [auth, logout]);

  const login = useCallback(async (email, password) => {
    const result = await api('/auth/login', { method: 'POST', body: { email, password } });
    saveAuth(result);
    setAuth(result);
    return result;
  }, []);

  const value = useMemo(
    () => ({ auth, isAuthenticated: Boolean(auth), login, logout: () => logout() }),
    [auth, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
