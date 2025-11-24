
"use client";

import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginAction, logoutAction, updateUserNameAction as updateUserNameDbAction, updateUserEmailAction as updateUserEmailDbAction } from '@/app/(auth)/actions';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (formData: FormData) => Promise<{ success?: boolean; error?: string; requires2FA?: boolean }>;
  logout: () => Promise<void>;
  updateUserName: (formData: FormData) => Promise<{ success: boolean, error?: string }>;
  updateUserEmail: (formData: FormData) => Promise<{ success: boolean, error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  // Use NextAuth session
  const { data: session, status: sessionStatus, update: updateSession } = useSession();

  // Fetch current user from server (fallback to legacy auth)
  const refreshUser = async () => {
    try {
      // First check NextAuth session
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.name || undefined,
          isAdmin: session.user.isAdmin,
          onboardingCompleted: session.user.onboardingCompleted,
        });
        setIsLoading(false);
        return;
      }

      // Fallback to legacy auth API
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Update user when NextAuth session changes
  useEffect(() => {
    if (sessionStatus === 'loading') {
      setIsLoading(true);
      return;
    }

    if (session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email!,
        name: session.user.name || undefined,
        isAdmin: session.user.isAdmin,
        onboardingCompleted: session.user.onboardingCompleted,
      });
      setIsLoading(false);
    } else {
      // Try legacy auth
      refreshUser();
    }
  }, [session, sessionStatus]);

  const login = async (formData: FormData) => {
    try {
      const result = await loginAction(formData);
      if (result.success) {
        // Refresh user data to get the authenticated user
        await refreshUser();
        return { success: true };
      }
      if (result.requires2FA) {
        // Return 2FA required flag to let component handle redirect
        return { requires2FA: true };
      }
      return result;
    } catch (error) {
      console.error('Login failed:', error);
      return { error: 'Login failed. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      // Sign out from NextAuth if there's a session
      if (session) {
        await nextAuthSignOut({ redirect: false });
      }
      
      // Also call legacy logout action
      await logoutAction();
      
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout action fails, clear local state
      setUser(null);
      router.push('/');
    }
  };

  const updateUserName = async (formData: FormData): Promise<{ success: boolean, error?: string }> => {
    if (!user) return { success: false, error: "User not authenticated." };
    setIsLoading(true);
    const result = await updateUserNameDbAction(user.id, formData);
    setIsLoading(false);

    if (result.success && result.user) {
      setUser(result.user);
      // Update NextAuth session if applicable
      if (session) {
        await updateSession();
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
      // Update NextAuth session if applicable
      if (session) {
        await updateSession();
      }
      return { success: true };
    }
    return { success: false, error: result.error || "Failed to update email." };
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUserName, updateUserEmail, refreshUser }}>
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
