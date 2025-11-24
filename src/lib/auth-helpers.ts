import { auth } from '@/lib/auth-server';
import type { User } from './types';
import { getCurrentUser as getLegacyCurrentUser } from './auth';

/**
 * Get the current authenticated user from either NextAuth or legacy auth system
 * This provides backward compatibility while transitioning to NextAuth
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  'use server';
  
  // First, try NextAuth session
  try {
    const session = await auth();
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email!,
        name: session.user.name || undefined,
        isAdmin: session.user.isAdmin,
      };
    }
  } catch (error) {
    console.error('Error getting NextAuth session:', error);
  }

  // Fall back to legacy auth system
  try {
    const legacyUser = await getLegacyCurrentUser();
    if (legacyUser) {
      return legacyUser;
    }
  } catch (error) {
    console.error('Error getting legacy user:', error);
  }

  return null;
}

/**
 * Check if user is authenticated using either system
 */
export async function isUserAuthenticated(): Promise<boolean> {
  'use server';
  const user = await getAuthenticatedUser();
  return user !== null;
}

/**
 * Check if user is an admin using either system
 */
export async function isUserAdmin(): Promise<boolean> {
  'use server';
  const user = await getAuthenticatedUser();
  return user?.isAdmin || false;
}

/**
 * Require authentication - throws if no user found
 */
export async function requireAuthentication(): Promise<User> {
  'use server';
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}
