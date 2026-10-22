import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, setToken, setUnauthorizedHandler } from "./api";
import type { Me } from "./types";

interface AuthCtx {
  user: Me | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    setUser(await api<Me>("/me"));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token } = await api<{ token: string }>("/auth/login", { method: "POST", body: { email, password } });
      setToken(token);
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  return <Ctx.Provider value={{ user, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
