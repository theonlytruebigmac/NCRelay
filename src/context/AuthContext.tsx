
"use client";

import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState }
from 'react';
import { loginAction, updateUserNameAction as updateUserNameDbAction, updateUserEmailAction as updateUserEmailDbAction } from '@/app/(auth)/actions';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (formData: FormData) => Promise<{ success: boolean, error?: string }>;
  logout: () => void;
  updateUserName: (formData: FormData) => Promise<{ success: boolean, error?: string }>;
  updateUserEmail: (formData: FormData) => Promise<{ success: boolean, error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = "relayzen_auth_user";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse stored user:", error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (formData: FormData): Promise<{ success: boolean, error?: string }> => {
    setIsLoading(true);
    const result = await loginAction(formData);
    setIsLoading(false);

    if (result.user) {
      setUser(result.user);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
      } catch (error) {
        console.error("Failed to save user to localStorage:", error);
      }
      return { success: true };
    }
    return { success: false, error: result.error || "Login failed." };
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to remove user from localStorage:", error);
    }
    router.push('/login'); // Ensure redirect happens
  };

  const updateUserName = async (formData: FormData): Promise<{ success: boolean, error?: string }> => {
    if (!user) return { success: false, error: "User not authenticated." };
    setIsLoading(true);
    const result = await updateUserNameDbAction(user.id, formData);
    setIsLoading(false);

    if (result.success && result.user) {
      setUser(result.user);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
      } catch (error) {
        console.error("Failed to update user name in localStorage:", error);
      }
      return { success: true };
    }
    return { success: false, error: result.error || "Failed to update name." };
  };

  const updateUserEmail = async (formData: FormData): Promise<{ success: boolean, error?: string }> => {
    if (!user) return { success: false, error: "User not authenticated." };
    setIsLoading(true);
    const result = await updateUserEmailDbAction(user.id, formData);
    setIsLoading(false);

    if (result.success && result.user) {
      setUser(result.user);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
      } catch (error) {
        console.error("Failed to update user email in localStorage:", error);
      }
      return { success: true };
    }
    return { success: false, error: result.error || "Failed to update email." };
  };


  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUserName, updateUserEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
