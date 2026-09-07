'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AdminUser } from '@/types';
import { getToken, setToken, clearToken } from '../api/client';
import { authApi } from '../api/auth';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedToken = getToken();
    const savedUser = authApi.getCurrentUser();
    if (savedToken && savedUser) {
      setTokenState(savedToken);
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    authApi.setCurrentUser(res.admin);
    setTokenState(res.token);
    setUser(res.admin);
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
    router.push('/login');
  };

  // Route protection
  useEffect(() => {
    if (!isLoading && !token && pathname !== '/login') {
      router.push('/login');
    }
  }, [isLoading, token, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
