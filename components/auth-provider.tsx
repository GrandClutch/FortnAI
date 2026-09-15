"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth/types";

type AuthStatus = "loading" | "authenticated" | "signed-out";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await response.json()) as { user?: AuthUser | null };
  return response.ok ? data.user ?? null : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextUser = await fetchCurrentUser();
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "signed-out");
      return nextUser;
    } catch {
      setUser(null);
      setStatus("signed-out");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser()
      .then((nextUser) => {
        if (cancelled) return;
        setUser(nextUser);
        setStatus(nextUser ? "authenticated" : "signed-out");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("signed-out");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    setUser(null);
    setStatus("signed-out");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
