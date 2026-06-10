import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setAccessToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((newToken) => {
    setAccessToken(newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore - clearing local state regardless
    }
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      applyToken(null);
      setUser(null);
    });

    // Try to restore session via httpOnly refresh cookie
    (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        applyToken(data.accessToken);
        const me = await api.get('/users/me');
        setUser(me.data.user);
      } catch {
        applyToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [applyToken]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    applyToken(data.accessToken);
    const me = await api.get('/users/me');
    setUser(me.data.user);
    return me.data.user;
  }, [applyToken]);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    applyToken(data.accessToken);
    const me = await api.get('/users/me');
    setUser(me.data.user);
    return me.data.user;
  }, [applyToken]);

  const guestLogin = useCallback(async () => {
    const { data } = await api.post('/auth/guest');
    applyToken(data.accessToken);
    setUser({ ...data.user, isGuest: true });
    return data.user;
  }, [applyToken]);

  const refreshUser = useCallback(async () => {
    const me = await api.get('/users/me');
    setUser(me.data.user);
    return me.data.user;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, guestLogin, logout, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
