import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import crypto from 'crypto';
import { getDB } from './db';

interface TwoFactorSecret {
  secret: string;
  otpauth_url: string;
}

interface BackupCode {
  code: string;
  used: boolean;
}

/**
 * Generate a new 2FA secret for a user
 */
export function generateTwoFactorSecret(userEmail: string, issuer: string = 'NCRelay'): TwoFactorSecret {
  const secret = speakeasy.generateSecret({
    name: `${issuer} (${userEmail})`,
    issuer,
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url || '',
  };
}

/**
 * Generate QR code data URL for scanning with authenticator app
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTwoFactorToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 steps before/after current time for clock drift
  });
}

/**
 * Generate backup codes for 2FA recovery
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

/**
 * Store 2FA secret and backup codes for a user
 */
export async function enrollUserIn2FA(
  userId: string,
  secret: string,
  backupCodes: string[],
  enforcedByAdmin: boolean = false
): Promise<void> {
  const db = await getDB();
  
  // Store backup codes as JSON with used flag
  const backupCodesJson = JSON.stringify(
    backupCodes.map(code => ({ code, used: false }))
  );
  
  db.prepare(`
    INSERT INTO user_2fa (userId, secret, backupCodes, isEnabled, enforcedByAdmin, enrolledAt)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET
      secret = excluded.secret,
      backupCodes = excluded.backupCodes,
      isEnabled = 1,
      enforcedByAdmin = excluded.enforcedByAdmin,
      enrolledAt = excluded.enrolledAt
  `).run(
    userId,
    secret,
    backupCodesJson,
    enforcedByAdmin ? 1 : 0,
    new Date().toISOString()
  );
}

/**
 * Get user's 2FA configuration
 */
export async function getUserTwoFactorConfig(userId: string): Promise<{
  isEnabled: boolean;
  secret: string | null;
  backupCodes: BackupCode[];
  enforcedByAdmin: boolean;
  enrolledAt: string | null;
  lastUsedAt: string | null;
} | null> {
  const db = await getDB();
  
  const config = db.prepare(`
    SELECT secret, backupCodes, isEnabled, enforcedByAdmin, enrolledAt, lastUsedAt
    FROM user_2fa
    WHERE userId = ?
  `).get(userId) as any;
  
  if (!config) {
    return null;
  }
  
  return {
    isEnabled: !!config.isEnabled,
    secret: config.secret,
    backupCodes: config.backupCodes ? JSON.parse(config.backupCodes) : [],
    enforcedByAdmin: !!config.enforcedByAdmin,
    enrolledAt: config.enrolledAt,
    lastUsedAt: config.lastUsedAt,
  };
}

/**
 * Verify 2FA token (TOTP or backup code)
 */
export async function verifyUserTwoFactor(
  userId: string,
  token: string
): Promise<{ success: boolean; usedBackupCode?: boolean }> {
  const config = await getUserTwoFactorConfig(userId);
  
  if (!config || !config.isEnabled || !config.secret) {
    return { success: false };
  }
  
  // Try TOTP first
  if (verifyTwoFactorToken(config.secret, token)) {
    // Update last used timestamp
    const db = await getDB();
    db.prepare(`
      UPDATE user_2fa
      SET lastUsedAt = ?
      WHERE userId = ?
    `).run(new Date().toISOString(), userId);
    
    return { success: true };
  }
  
  // Try backup codes
  const normalizedToken = token.replace(/\s/g, '').toUpperCase();
  const backupCodeIndex = config.backupCodes.findIndex(
    bc => bc.code === normalizedToken && !bc.used
  );
  
  if (backupCodeIndex !== -1) {
    // Mark backup code as used
    config.backupCodes[backupCodeIndex].used = true;
    
    const db = await getDB();
    db.prepare(`
      UPDATE user_2fa
      SET backupCodes = ?, lastUsedAt = ?
      WHERE userId = ?
    `).run(
      JSON.stringify(config.backupCodes),
      new Date().toISOString(),
      userId
    );
    
    return { success: true, usedBackupCode: true };
  }
  
  return { success: false };
}

/**
 * Disable 2FA for a user
 */
export async function disableTwoFactor(userId: string): Promise<void> {
  const db = await getDB();
  
  db.prepare(`
    UPDATE user_2fa
    SET isEnabled = 0
    WHERE userId = ?
  `).run(userId);
}

/**
 * Reset 2FA for a user (admin action)
 */
export async function resetTwoFactor(userId: string): Promise<void> {
  const db = await getDB();
  
  db.prepare(`
    DELETE FROM user_2fa
    WHERE userId = ?
  `).run(userId);
}

/**
 * Regenerate backup codes for a user
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const config = await getUserTwoFactorConfig(userId);
  
  if (!config || !config.isEnabled) {
    throw new Error('2FA is not enabled for this user');
  }
  
  const newBackupCodes = generateBackupCodes();
  const backupCodesJson = JSON.stringify(
    newBackupCodes.map(code => ({ code, used: false }))
  );
  
  const db = await getDB();
  db.prepare(`
    UPDATE user_2fa
    SET backupCodes = ?
    WHERE userId = ?
  `).run(backupCodesJson, userId);
  
  return newBackupCodes;
}

/**
 * Check if 2FA is required for a user based on tenant settings
 */
export async function is2FARequired(userId: string, tenantId: string): Promise<boolean> {
  const db = await getDB();
  
  // Check tenant security settings
  const tenantSettings = db.prepare(`
    SELECT enforce2FA, require2FAForAdmins
    FROM tenant_security_settings
    WHERE tenantId = ?
  `).get(tenantId) as any;
  
  if (!tenantSettings) {
    return false;
  }
  
  // If 2FA is enforced for all users
  if (tenantSettings.enforce2FA) {
    return true;
  }
  
  // If 2FA is required for admins only, check user role
  if (tenantSettings.require2FAForAdmins) {
    const userRole = db.prepare(`
      SELECT role FROM tenant_users
      WHERE tenantId = ? AND userId = ?
    `).get(tenantId, userId) as any;
    
    if (userRole && ['owner', 'admin'].includes(userRole.role)) {
      return true;
    }
  }
  
  // Check if admin has enforced 2FA for this specific user
  const user2FA = db.prepare(`
    SELECT enforcedByAdmin
    FROM user_2fa
    WHERE userId = ?
  `).get(userId) as any;
  
  return user2FA ? !!user2FA.enforcedByAdmin : false;
}
