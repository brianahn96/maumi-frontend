import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  bootstrapSession,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type AuthUser,
} from "@/lib/api-client";
import { setChatStorageUser } from "@/lib/chat-db";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep chat-db scoped to the current user
  useEffect(() => {
    setChatStorageUser(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    bootstrapSession()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    signIn: async (email, password) => {
      await apiLogin(email, password);
      const me = await fetchMe();
      setUser(me);
    },
    signUp: async (email, password) => {
      await apiRegister(email, password);
      await apiLogin(email, password);
      const me = await fetchMe();
      setUser(me);
    },
    signOut: async () => {
      await apiLogout();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
