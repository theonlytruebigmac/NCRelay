import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { User } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const TOKEN_COOKIE_NAME = 'ncrelay-auth-token';
const TOKEN_EXPIRY = '7d'; // 7 days

export interface AuthTokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateAuthToken(user: User): string {
  const payload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT token
 */
export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Set authentication cookie
 */
export async function setAuthCookie(user: User): Promise<void> {
  'use server';
  
  const token = generateAuthToken(user);
  const cookieStore = await cookies();
  
  cookieStore.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  });
}

/**
 * Remove authentication cookie
 */
export async function removeAuthCookie(): Promise<void> {
  'use server';
  
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
}

/**
 * Get the current authenticated user from the request
 */
export async function getCurrentUser(): Promise<User | null> {
  'use server';
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
    
    if (!token) {
      return null;
    }
    
    const payload = verifyAuthToken(token);
    if (!payload) {
      return null;
    }
    
  // Fetch fresh user data from database
  const { getUserById } = await import('./db');
  const user = await getUserById(payload.userId);
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Require authentication - throws if no user found
 */
export async function requireAuth(): Promise<User> {
  'use server';
  
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  'use server';
  
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  'use server';
  
  const user = await getCurrentUser();
  return user?.isAdmin || false;
}

/**
 * Middleware helper to get user from token without cookies (for API routes)
 */
export async function getUserFromToken(token: string): Promise<User | null> {
  const payload = verifyAuthToken(token);
  if (!payload) {
    return null;
  }
  const { getUserById } = await import('./db');
  return getUserById(payload.userId);
}
