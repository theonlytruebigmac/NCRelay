import { getDB } from './db';

interface TenantSecuritySettings {
  tenantId: string;
  enforce2FA: boolean;
  require2FAForAdmins: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  passwordMinUppercase: number;
  passwordMinLowercase: number;
  passwordMinNumbers: number;
  passwordMinSymbols: number;
  sessionTimeoutMinutes: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  rateLimitEnabled: boolean;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  rateLimitIpWhitelist: string[];
}

/**
 * Get tenant security settings
 */
export async function getTenantSecuritySettings(tenantId: string): Promise<TenantSecuritySettings | null> {
  const db = await getDB();
  
  const settings = db.prepare(`
    SELECT * FROM tenant_security_settings
    WHERE tenantId = ?
  `).get(tenantId) as any;
  
  if (!settings) {
    return null;
  }
  
  return {
    tenantId: settings.tenantId,
    enforce2FA: !!settings.enforce2FA,
    require2FAForAdmins: !!settings.require2FAForAdmins,
    passwordMinLength: settings.passwordMinLength || 8,
    passwordRequireUppercase: !!settings.passwordRequireUppercase,
    passwordRequireLowercase: !!settings.passwordRequireLowercase,
    passwordRequireNumbers: !!settings.passwordRequireNumbers,
    passwordRequireSymbols: !!settings.passwordRequireSymbols,
    passwordMinUppercase: settings.passwordMinUppercase || 0,
    passwordMinLowercase: settings.passwordMinLowercase || 0,
    passwordMinNumbers: settings.passwordMinNumbers || 0,
    passwordMinSymbols: settings.passwordMinSymbols || 0,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes || 480,
    maxFailedLoginAttempts: settings.maxFailedLoginAttempts || 5,
    lockoutDurationMinutes: settings.lockoutDurationMinutes || 15,
    rateLimitEnabled: settings.rateLimitEnabled !== undefined ? !!settings.rateLimitEnabled : true,
    rateLimitMaxRequests: settings.rateLimitMaxRequests || 100,
    rateLimitWindowMs: settings.rateLimitWindowMs || 60000,
    rateLimitIpWhitelist: JSON.parse(settings.rateLimitIpWhitelist as string || '[]'),
  };
}

/**
 * Upsert tenant security settings
 */
export async function upsertTenantSecuritySettings(
  tenantId: string,
  settings: Partial<Omit<TenantSecuritySettings, 'tenantId'>>
): Promise<void> {
  const db = await getDB();
  
  const currentSettings = await getTenantSecuritySettings(tenantId);
  
  const finalSettings = {
    tenantId,
    enforce2FA: settings.enforce2FA ?? currentSettings?.enforce2FA ?? false,
    require2FAForAdmins: settings.require2FAForAdmins ?? currentSettings?.require2FAForAdmins ?? false,
    passwordMinLength: settings.passwordMinLength ?? currentSettings?.passwordMinLength ?? 8,
    passwordRequireUppercase: settings.passwordRequireUppercase ?? currentSettings?.passwordRequireUppercase ?? false,
    passwordRequireLowercase: settings.passwordRequireLowercase ?? currentSettings?.passwordRequireLowercase ?? false,
    passwordRequireNumbers: settings.passwordRequireNumbers ?? currentSettings?.passwordRequireNumbers ?? false,
    passwordRequireSymbols: settings.passwordRequireSymbols ?? currentSettings?.passwordRequireSymbols ?? false,
    passwordMinUppercase: settings.passwordMinUppercase ?? currentSettings?.passwordMinUppercase ?? 0,
    passwordMinLowercase: settings.passwordMinLowercase ?? currentSettings?.passwordMinLowercase ?? 0,
    passwordMinNumbers: settings.passwordMinNumbers ?? currentSettings?.passwordMinNumbers ?? 0,
    passwordMinSymbols: settings.passwordMinSymbols ?? currentSettings?.passwordMinSymbols ?? 0,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes ?? currentSettings?.sessionTimeoutMinutes ?? 480,
    maxFailedLoginAttempts: settings.maxFailedLoginAttempts ?? currentSettings?.maxFailedLoginAttempts ?? 5,
    lockoutDurationMinutes: settings.lockoutDurationMinutes ?? currentSettings?.lockoutDurationMinutes ?? 15,
    rateLimitEnabled: settings.rateLimitEnabled ?? currentSettings?.rateLimitEnabled ?? true,
    rateLimitMaxRequests: settings.rateLimitMaxRequests ?? currentSettings?.rateLimitMaxRequests ?? 100,
    rateLimitWindowMs: settings.rateLimitWindowMs ?? currentSettings?.rateLimitWindowMs ?? 60000,
    rateLimitIpWhitelist: settings.rateLimitIpWhitelist ?? currentSettings?.rateLimitIpWhitelist ?? [],
  };
  
  db.prepare(`
    INSERT INTO tenant_security_settings (
      tenantId, enforce2FA, require2FAForAdmins, passwordMinLength,
      passwordRequireUppercase, passwordRequireLowercase, passwordRequireNumbers,
      passwordRequireSymbols, passwordMinUppercase, passwordMinLowercase,
      passwordMinNumbers, passwordMinSymbols, sessionTimeoutMinutes,
      maxFailedLoginAttempts, lockoutDurationMinutes, rateLimitEnabled,
      rateLimitMaxRequests, rateLimitWindowMs, rateLimitIpWhitelist
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenantId) DO UPDATE SET
      enforce2FA = excluded.enforce2FA,
      require2FAForAdmins = excluded.require2FAForAdmins,
      passwordMinLength = excluded.passwordMinLength,
      passwordRequireUppercase = excluded.passwordRequireUppercase,
      passwordRequireLowercase = excluded.passwordRequireLowercase,
      passwordRequireNumbers = excluded.passwordRequireNumbers,
      passwordRequireSymbols = excluded.passwordRequireSymbols,
      passwordMinUppercase = excluded.passwordMinUppercase,
      passwordMinLowercase = excluded.passwordMinLowercase,
      passwordMinNumbers = excluded.passwordMinNumbers,
      passwordMinSymbols = excluded.passwordMinSymbols,
      sessionTimeoutMinutes = excluded.sessionTimeoutMinutes,
      maxFailedLoginAttempts = excluded.maxFailedLoginAttempts,
      lockoutDurationMinutes = excluded.lockoutDurationMinutes,
      rateLimitEnabled = excluded.rateLimitEnabled,
      rateLimitMaxRequests = excluded.rateLimitMaxRequests,
      rateLimitWindowMs = excluded.rateLimitWindowMs,
      rateLimitIpWhitelist = excluded.rateLimitIpWhitelist
  `).run(
    finalSettings.tenantId,
    finalSettings.enforce2FA ? 1 : 0,
    finalSettings.require2FAForAdmins ? 1 : 0,
    finalSettings.passwordMinLength,
    finalSettings.passwordRequireUppercase ? 1 : 0,
    finalSettings.passwordRequireLowercase ? 1 : 0,
    finalSettings.passwordRequireNumbers ? 1 : 0,
    finalSettings.passwordRequireSymbols ? 1 : 0,
    finalSettings.passwordMinUppercase,
    finalSettings.passwordMinLowercase,
    finalSettings.passwordMinNumbers,
    finalSettings.passwordMinSymbols,
    finalSettings.sessionTimeoutMinutes,
    finalSettings.maxFailedLoginAttempts,
    finalSettings.lockoutDurationMinutes,
    finalSettings.rateLimitEnabled ? 1 : 0,
    finalSettings.rateLimitMaxRequests,
    finalSettings.rateLimitWindowMs,
    JSON.stringify(finalSettings.rateLimitIpWhitelist)
  );
}

/**
 * Check if user needs to enroll in 2FA based on tenant policy
 */
export async function checkUserNeedsEnroll2FA(userId: string, tenantId: string): Promise<boolean> {
  const db = await getDB();
  
  // Check if user already has 2FA enabled
  const user2FA = db.prepare(`
    SELECT isEnabled FROM user_2fa WHERE userId = ?
  `).get(userId) as any;
  
  if (user2FA?.isEnabled) {
    return false; // Already enrolled
  }
  
  // Check tenant security settings
  const settings = await getTenantSecuritySettings(tenantId);
  
  if (!settings) {
    return false; // No enforcement
  }
  
  // If 2FA is enforced for all users
  if (settings.enforce2FA) {
    return true;
  }
  
  // If 2FA is required for admins, check user role
  if (settings.require2FAForAdmins) {
    const userRole = db.prepare(`
      SELECT role FROM tenant_users
      WHERE tenantId = ? AND userId = ?
    `).get(tenantId, userId) as any;
    
    if (userRole && ['owner', 'admin'].includes(userRole.role)) {
      return true;
    }
  }
  
  return false;
}
