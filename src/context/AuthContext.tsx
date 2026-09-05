import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/lib/api-types";
import { api, getStoredToken, setStoredToken } from "@/lib/api";

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (fullName: string, email: string, password: string) => Promise<boolean>;
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

    try {
      const user = await api.me();
      setCurrentUser(user);
    } catch {
      setStoredToken(null);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
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

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password);
      setCurrentUser(response.user);
      localStorage.setItem("current_password", password);
      return true;
    } catch (error) {
      console.error("[AUTH_DEBUG] Login error:", error);
      throw error;
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    try {
      const response = await api.register(fullName, email, password);
      setCurrentUser(response.user);
      localStorage.setItem("current_password", password);
      return true;
    } catch {
      return false;
    }
  };

  const logout = (options?: { skipServer?: boolean; message?: string }) => {
    if (!options?.skipServer && getStoredToken()) {
      void api.logout().catch(() => undefined);
    }
    setStoredToken(null);
    localStorage.removeItem("current_password");
    setCurrentUser(null);
    if (options?.message) {
      sessionStorage.setItem("auth_notice", options.message);
    }
  };

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
