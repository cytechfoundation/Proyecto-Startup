import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("cytech_token") || null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Callback OAuth: /dashboard?token=JWT
    const q = new URLSearchParams(window.location.search).get("token");
    if (q) {
      localStorage.setItem("cytech_token", q);
      setToken(q);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  useEffect(() => {
    if (!token) { setUser(null); return; }
    api.me(token).then(setUser).catch(() => {
      localStorage.removeItem("cytech_token");
      setToken(null);
    });
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem("cytech_token");
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback((t) => {
    localStorage.setItem("cytech_token", t);
    setToken(t);
  }, []);

  const refresh = useCallback(async () => {
    const t = localStorage.getItem("cytech_token");
    if (!t) return;
    try {
      setUser(await api.me(t));
    } catch {
      localStorage.removeItem("cytech_token");
      setToken(null);
    }
  }, []);

  const value = useMemo(() => ({ token, user, login, logout, refresh }), [token, user, login, logout, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
