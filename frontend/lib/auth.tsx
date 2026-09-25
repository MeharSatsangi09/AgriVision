"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, isDemoMode } from "@/lib/firebase";

// Phone-number login state. `loading` is true until Firebase has reported the saved session (so gated pages
// don't flash the login prompt at someone who is already logged in).
interface AuthState {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ user: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const logout = useCallback(() => signOut(auth), []);
  const value = useMemo(() => ({ user, loading, logout }), [user, loading, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
