import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getUserById, getDB } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { User } from '@/lib/types';

declare module 'next-auth' {
  interface Session {
    user: User & {
      id: string;
    };
  }

  interface User extends Omit<import('@/lib/types').User, 'provider' | 'providerId' | 'providerAccountId'> {
    id: string;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    // Local credentials provider for email/password authentication
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await getUserByEmail(credentials.email as string);

        if (!user || !user.hashedPassword) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );

        if (!passwordMatch) {
          return null;
        }

        // Return user without hashedPassword
        const { hashedPassword, ...userWithoutPassword } = user;
        return {
          id: userWithoutPassword.id,
          email: userWithoutPassword.email,
          name: userWithoutPassword.name,
          isAdmin: userWithoutPassword.isAdmin,
        };
      },
    }),

    // Google OAuth provider
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      // Allow sign in even if env vars are not set (for dev mode)
      allowDangerousEmailAccountLinking: false,
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers (Google, Apple)
      if (account?.provider !== 'credentials') {
        try {
          const db = await getDB();
          
          // Check if user exists by email
          let existingUser = await getUserByEmail(user.email!);

          if (existingUser) {
            // User exists - check if they're trying to link a new provider
            if (existingUser.provider !== account?.provider) {
              // User exists with different provider
              // You can either:
              // 1. Allow account linking (update the user)
              // 2. Deny sign in (return false)
              // For security, we'll deny for now
              console.warn(`User ${user.email} attempted to sign in with ${account?.provider} but already has a ${existingUser.provider} account`);
              return false;
            }
            
            // Update providerId if it changed
            if (account?.providerAccountId && existingUser.providerAccountId !== account.providerAccountId) {
              const stmt = db.prepare(
                'UPDATE users SET providerAccountId = ?, updatedAt = ? WHERE id = ?'
              );
              stmt.run(account.providerAccountId, new Date().toISOString(), existingUser.id);
            }
          } else {
            // Create new user from OAuth
            const now = new Date().toISOString();
            const userId = uuidv4();
            
            const stmt = db.prepare(`
              INSERT INTO users (
                id, email, name, provider, providerId, providerAccountId, 
                hashedPassword, isAdmin, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)
            `);
            
            stmt.run(
              userId,
              user.email,
              user.name || profile?.name || 'OAuth User',
              account?.provider,
              account?.providerAccountId,
              account?.providerAccountId,
              now,
              now
            );
            
            console.log(`Created new OAuth user: ${user.email} via ${account?.provider}`);
          }

          return true;
        } catch (error) {
          console.error('Error in signIn callback:', error);
          return false;
        }
      }

      // For credentials provider, just allow sign in
      return true;
    },

    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.isAdmin = user.isAdmin;
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }

      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};
