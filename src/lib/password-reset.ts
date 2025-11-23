import { getDB } from './db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

/**
 * Generate a secure password reset token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a password reset token for a user
 * @param userId User ID
 * @param expirationHours How many hours until the token expires (default 24)
 */
export async function createPasswordResetToken(
  userId: string,
  expirationHours: number = 24
): Promise<string> {
  const db = await getDB();
  const token = generateResetToken();
  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);

  db.prepare(`
    INSERT INTO password_reset_tokens (id, userId, token, expiresAt, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, token, expiresAt.toISOString(), now.toISOString());

  return token;
}

/**
 * Validate a password reset token
 * @returns User ID if valid, null if invalid/expired
 */
export async function validateResetToken(token: string): Promise<string | null> {
  const db = await getDB();
  const now = new Date().toISOString();

  const result = db.prepare(`
    SELECT userId, expiresAt, usedAt
    FROM password_reset_tokens
    WHERE token = ?
  `).get(token) as { userId: string; expiresAt: string; usedAt: string | null } | undefined;

  if (!result) {
    return null;
  }

  // Check if token has been used
  if (result.usedAt) {
    return null;
  }

  // Check if token is expired
  if (new Date(result.expiresAt) < new Date(now)) {
    return null;
  }

  return result.userId;
}

/**
 * Mark a password reset token as used
 */
export async function markTokenAsUsed(token: string): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE password_reset_tokens
    SET usedAt = ?
    WHERE token = ?
  `).run(now, token);
}

/**
 * Delete expired password reset tokens (cleanup)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();

  const result = db.prepare(`
    DELETE FROM password_reset_tokens
    WHERE expiresAt < ?
  `).run(now);

  return result.changes;
}

/**
 * Revoke all password reset tokens for a user
 */
export async function revokeUserTokens(userId: string): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE password_reset_tokens
    SET usedAt = ?
    WHERE userId = ? AND usedAt IS NULL
  `).run(now, userId);
}
