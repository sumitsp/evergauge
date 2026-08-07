import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken, getAuthToken } from "./api";

const AuthContext = createContext(null);
const STORAGE_KEY = "meridianqa_session";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getAuthToken());
  const [booting, setBooting] = useState(true);
  const [directory, setDirectory] = useState([]);
  const [error, setError] = useState(null);

  const applySession = useCallback((nextToken, nextUser) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken && nextUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const dir = await api.authDirectory();
        if (alive) setDirectory(dir.users || []);
      } catch {
        if (alive) setDirectory([]);
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?.token) {
            setAuthToken(parsed.token);
            const me = await api.authMe();
            if (alive) applySession(parsed.token, me.user);
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
          setAuthToken(null);
        }
      }
      if (alive) setBooting(false);
    })();
    return () => { alive = false; };
  }, [applySession]);

  const login = useCallback(async (emailOrUserId, password) => {
    setError(null);
    let payload;
    if (emailOrUserId && typeof emailOrUserId === "object" && emailOrUserId.email) {
      payload = { email: String(emailOrUserId.email).trim(), password: String(emailOrUserId.password || "") };
    } else if (typeof emailOrUserId === "string" && emailOrUserId.includes("@") && password != null) {
      payload = { email: emailOrUserId.trim(), password: String(password) };
    } else {
      payload = { userId: Number(emailOrUserId) };
    }
    const data = await api.authLogin(payload);
    applySession(data.token, data.user);
    return data.user;
  }, [applySession]);

  const loginWithGoogle = useCallback(async (credential) => {
    setError(null);
    const data = await api.authGoogle(credential);
    applySession(data.token, data.user);
    return data.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      if (getAuthToken()) await api.authLogout();
    } catch { /* ignore */ }
    applySession(null, null);
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      token,
      booting,
      directory,
      error,
      setError,
      login,
      loginWithGoogle,
      logout,
      isAdmin: user?.role === "admin",
      isEmployee: user?.role === "employee",
      authenticated: Boolean(user && token),
    }),
    [user, token, booting, directory, error, login, loginWithGoogle, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
