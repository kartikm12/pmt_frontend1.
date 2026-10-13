import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@/lib/api-types";
import { api, getStoredToken, setStoredToken } from "@/lib/api";

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (fullName: string, email: string, password: string) => Promise<{ pending: boolean; message?: string }>;
  logout: (options?: { skipServer?: boolean; message?: string }) => void;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCurrentUser = async () => {
    if (!getStoredToken()) {
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    // Only a server that rejects the session signs you out. A failed or cancelled request (network blip,
    // page reloaded mid-request, server waking up) used to delete the sign-in too; now it retries for ~1 min.
    for (let attempt = 0; ; attempt++) {
      try {
        const user = await api.me();
        setCurrentUser(user);
        break;
      } catch (error: any) {
        const rejected = error?.status === 401 || error?.status === 403 || error?.status === 404;
        if (rejected || attempt >= 7) {
          if (rejected) setStoredToken(null);
          setCurrentUser(null);
          break;
        }
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 15000)));
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void refreshCurrentUser();
  }, []);

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      logout({ skipServer: true, message: customEvent.detail?.message });
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  // Errors (e.g. wrong password) propagate to the form, which shows them
  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    setCurrentUser(response.user);
    return true;
  };

  // Errors (e.g. email already registered) propagate so the form can show them
  const register = async (fullName: string, email: string, password: string) => {
    const response = await api.register(fullName, email, password);
    if (response.pending) return { pending: true, message: response.message };
    setCurrentUser(response.user);
    return { pending: false };
  };

  // Stable identity: SocketProvider reconnects whenever logout changes
  const logout = useCallback((options?: { skipServer?: boolean; message?: string }) => {
    if (!options?.skipServer && getStoredToken()) {
      void api.logout().catch(() => undefined);
    }
    setStoredToken(null);
    localStorage.removeItem("current_password"); // clears plain-text passwords saved by older builds
    setCurrentUser(null);
    if (options?.message) {
      sessionStorage.setItem("auth_notice", options.message);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, register, logout, refreshCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
