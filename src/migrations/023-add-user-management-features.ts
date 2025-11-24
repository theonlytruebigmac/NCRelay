import Database from 'better-sqlite3';

export const id = 23;
export const name = 'add-user-management-features';

export function up(db: Database.Database): void {
  // Tenant SMTP Settings - encrypted per-tenant email configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_smtp_settings (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL UNIQUE,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 587,
      username TEXT NOT NULL,
      encryptedPassword TEXT NOT NULL, -- Encrypted using crypto.ts
      fromAddress TEXT NOT NULL,
      fromName TEXT,
      useTLS BOOLEAN NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_tenant_smtp_tenant ON tenant_smtp_settings(tenantId);
  `);

  // Password Reset Tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      usedAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_password_reset_user ON password_reset_tokens(userId);
    CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);
    CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expiresAt);
  `);

  // User 2FA Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_2fa (
      userId TEXT PRIMARY KEY,
      secret TEXT NOT NULL, -- Encrypted TOTP secret
      backupCodes TEXT NOT NULL, -- JSON array of encrypted backup codes
      isEnabled BOOLEAN NOT NULL DEFAULT 0,
      enforcedByAdmin BOOLEAN NOT NULL DEFAULT 0,
      enrolledAt TEXT,
      lastUsedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Tenant 2FA Settings - add to tenant_settings or create separate table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_security_settings (
      tenantId TEXT PRIMARY KEY,
      enforce2FA BOOLEAN NOT NULL DEFAULT 0,
      require2FAForAdmins BOOLEAN NOT NULL DEFAULT 0,
      passwordMinLength INTEGER NOT NULL DEFAULT 8,
      passwordRequireSpecialChar BOOLEAN NOT NULL DEFAULT 0,
      sessionTimeoutMinutes INTEGER NOT NULL DEFAULT 480, -- 8 hours
      maxFailedLoginAttempts INTEGER NOT NULL DEFAULT 5,
      lockoutDurationMinutes INTEGER NOT NULL DEFAULT 15,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );
  `);

  // Security Audit Log
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_audit_log (
      id TEXT PRIMARY KEY,
      userId TEXT,
      tenantId TEXT,
      action TEXT NOT NULL, -- login_success, login_failed, password_changed, 2fa_enrolled, 2fa_reset, role_changed, etc.
      details TEXT, -- JSON with additional context
      ipAddress TEXT,
      userAgent TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_audit_user ON security_audit_log(userId);
    CREATE INDEX idx_audit_tenant ON security_audit_log(tenantId);
    CREATE INDEX idx_audit_action ON security_audit_log(action);
    CREATE INDEX idx_audit_created ON security_audit_log(createdAt);
  `);

  // User Sessions - for session management
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY, -- Session ID
      userId TEXT NOT NULL,
      tenantId TEXT, -- Which tenant context (if applicable)
      ipAddress TEXT,
      userAgent TEXT,
      deviceInfo TEXT, -- JSON: browser, os, device type
      lastActivityAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_sessions_user ON user_sessions(userId);
    CREATE INDEX idx_sessions_tenant ON user_sessions(tenantId);
    CREATE INDEX idx_sessions_expires ON user_sessions(expiresAt);
  `);

  // Failed Login Attempts - for account lockout protection
  db.exec(`
    CREATE TABLE IF NOT EXISTS failed_login_attempts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      ipAddress TEXT,
      attemptedAt TEXT NOT NULL,
      reason TEXT -- wrong_password, account_locked, 2fa_failed, etc.
    );
    CREATE INDEX idx_failed_login_email ON failed_login_attempts(email);
    CREATE INDEX idx_failed_login_attempted ON failed_login_attempts(attemptedAt);
  `);

  // Account Lockouts
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_lockouts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      lockedAt TEXT NOT NULL,
      unlockAt TEXT NOT NULL,
      reason TEXT NOT NULL,
      unlockedAt TEXT, -- When it was actually unlocked (manual or automatic)
      unlockedBy TEXT, -- Admin userId who manually unlocked
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_lockouts_user ON account_lockouts(userId);
    CREATE INDEX idx_lockouts_unlock ON account_lockouts(unlockAt);
  `);

  console.log('✅ Migration 007: User management features tables created');
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS account_lockouts;
    DROP TABLE IF EXISTS failed_login_attempts;
    DROP TABLE IF EXISTS user_sessions;
    DROP TABLE IF EXISTS security_audit_log;
    DROP TABLE IF EXISTS tenant_security_settings;
    DROP TABLE IF EXISTS user_2fa;
    DROP TABLE IF EXISTS password_reset_tokens;
    DROP TABLE IF EXISTS tenant_smtp_settings;
  `);

  console.log('✅ Migration 007: User management features tables dropped');
}
