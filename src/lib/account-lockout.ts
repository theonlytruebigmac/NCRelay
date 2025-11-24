import { getDB } from './db';
import { logSecurityEvent } from './audit-log';
import { autoBlacklistIP } from './ip-access-control';

interface FailedLoginAttempt {
  id: string;
  email: string;
  ipAddress: string | null;
  attemptedAt: string;
  reason: string | null;
}

interface AccountLockout {
  id: string;
  userId: string;
  lockedAt: string;
  unlockAt: string;
  reason: string;
  unlockedAt: string | null;
  unlockedBy: string | null;
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(
  email: string,
  ipAddress: string | null,
  reason: string | null = null
): Promise<void> {
  const db = await getDB();
  const { v4: uuidv4 } = await import('uuid');
  
  db.prepare(`
    INSERT INTO failed_login_attempts (id, email, ipAddress, attemptedAt, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    email,
    ipAddress,
    new Date().toISOString(),
    reason
  );
}

/**
 * Get failed login attempts for an email in a time window
 */
export async function getRecentFailedAttempts(
  email: string,
  minutesWindow: number = 15
): Promise<FailedLoginAttempt[]> {
  const db = await getDB();
  const cutoffTime = new Date(Date.now() - minutesWindow * 60 * 1000).toISOString();
  
  return db.prepare(`
    SELECT * FROM failed_login_attempts
    WHERE email = ? AND attemptedAt > ?
    ORDER BY attemptedAt DESC
  `).all(email, cutoffTime) as FailedLoginAttempt[];
}

/**
 * Clear failed login attempts for an email (after successful login)
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  const db = await getDB();
  
  db.prepare(`
    DELETE FROM failed_login_attempts
    WHERE email = ?
  `).run(email);
}

/**
 * Check if account is currently locked
 */
export async function isAccountLocked(userId: string): Promise<{
  isLocked: boolean;
  lockout: AccountLockout | null;
}> {
  const db = await getDB();
  
  const lockout = db.prepare(`
    SELECT * FROM account_lockouts
    WHERE userId = ? 
      AND unlockedAt IS NULL 
      AND unlockAt > datetime('now')
    ORDER BY lockedAt DESC
    LIMIT 1
  `).get(userId) as AccountLockout | undefined;
  
  return {
    isLocked: !!lockout,
    lockout: lockout || null,
  };
}

/**
 * Lock an account
 */
export async function lockAccount(
  userId: string,
  durationMinutes: number,
  reason: string = 'Too many failed login attempts'
): Promise<void> {
  const db = await getDB();
  const { v4: uuidv4 } = await import('uuid');
  
  const now = new Date();
  const unlockAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  
  db.prepare(`
    INSERT INTO account_lockouts (id, userId, lockedAt, unlockAt, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    userId,
    now.toISOString(),
    unlockAt.toISOString(),
    reason
  );
  
  // Get user info for logging
  const user = db.prepare(`
    SELECT tenantId FROM users WHERE id = ?
  `).get(userId) as { tenantId: string | null } | undefined;
  
  // Log account lockout
  await logSecurityEvent('account_locked', {
    userId,
    tenantId: user?.tenantId || undefined,
    details: { reason, durationMinutes },
  });
}

/**
 * Unlock an account manually (admin action)
 */
export async function unlockAccount(
  userId: string,
  unlockedBy: string
): Promise<void> {
  const db = await getDB();
  
  // Get user info for logging
  const user = db.prepare(`
    SELECT tenantId FROM users WHERE id = ?
  `).get(userId) as { tenantId: string | null } | undefined;
  
  db.prepare(`
    UPDATE account_lockouts
    SET unlockedAt = ?, unlockedBy = ?
    WHERE userId = ? AND unlockedAt IS NULL
  `).run(new Date().toISOString(), unlockedBy, userId);
  
  // Log account unlock
  await logSecurityEvent('account_unlocked', {
    userId,
    tenantId: user?.tenantId || undefined,
    details: { unlockedBy },
  });
}

/**
 * Check if account should be locked based on failed attempts
 * Returns true if account was just locked
 * Also blacklists the IP address if multiple attempts from same IP
 */
export async function checkAndLockAccount(
  email: string,
  maxAttempts: number = 5,
  lockoutMinutes: number = 15
): Promise<{
  shouldLock: boolean;
  attemptsRemaining: number;
  lockedUntil?: Date;
}> {
  const db = await getDB();
  
  // Get user by email
  const user = db.prepare('SELECT id, tenantId FROM users WHERE email = ?').get(email) as any;
  
  if (!user) {
    return { shouldLock: false, attemptsRemaining: maxAttempts };
  }
  
  // Check if already locked
  const { isLocked, lockout } = await isAccountLocked(user.id);
  if (isLocked && lockout) {
    return {
      shouldLock: true,
      attemptsRemaining: 0,
      lockedUntil: new Date(lockout.unlockAt),
    };
  }
  
  // Get recent failed attempts
  const recentAttempts = await getRecentFailedAttempts(email, lockoutMinutes);
  const attemptsCount = recentAttempts.length;
  
  if (attemptsCount >= maxAttempts) {
    // Lock the account
    await lockAccount(user.id, lockoutMinutes, 'Too many failed login attempts');
    
    // Check if multiple attempts from same IP and blacklist it
    const ipCounts = new Map<string, number>();
    for (const attempt of recentAttempts) {
      if (attempt.ipAddress) {
        ipCounts.set(attempt.ipAddress, (ipCounts.get(attempt.ipAddress) || 0) + 1);
      }
    }
    
    // Blacklist any IP with 3+ failed attempts (temporary)
    for (const [ip, count] of ipCounts.entries()) {
      if (count >= 3) {
        await autoBlacklistIP(
          ip,
          `Automated blacklist: ${count} failed login attempts for ${email}`,
          undefined, // User type doesn't have tenantId
          lockoutMinutes
        );
      }
    }
    
    return {
      shouldLock: true,
      attemptsRemaining: 0,
      lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000),
    };
  }
  
  return {
    shouldLock: false,
    attemptsRemaining: maxAttempts - attemptsCount,
  };
}

/**
 * Get all locked accounts
 */
export async function getLockedAccounts(): Promise<Array<AccountLockout & { userName: string; userEmail: string }>> {
  const db = await getDB();
  
  return db.prepare(`
    SELECT 
      l.*,
      u.name as userName,
      u.email as userEmail
    FROM account_lockouts l
    JOIN users u ON l.userId = u.id
    WHERE l.unlockedAt IS NULL AND l.unlockAt > datetime('now')
    ORDER BY l.lockedAt DESC
  `).all() as any[];
}

/**
 * Clean up old failed login attempts (older than 24 hours)
 */
export async function cleanupOldFailedAttempts(): Promise<number> {
  const db = await getDB();
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const result = db.prepare(`
    DELETE FROM failed_login_attempts
    WHERE attemptedAt < ?
  `).run(cutoffTime);
  
  return result.changes;
}

/**
 * Get lockout history for a user
 */
export async function getUserLockoutHistory(userId: string): Promise<AccountLockout[]> {
  const db = await getDB();
  
  return db.prepare(`
    SELECT * FROM account_lockouts
    WHERE userId = ?
    ORDER BY lockedAt DESC
    LIMIT 10
  `).all(userId) as AccountLockout[];
}
