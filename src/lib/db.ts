'use server';
import Database from 'better-sqlite3';
import type { Integration, ApiEndpointConfig, LogEntry, User, SmtpSettings, FieldFilterConfig, Platform } from './types';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, decrypt } from './crypto';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const DB_PATH = process.env.NODE_ENV === 'production' ? '/data/app.db' : 'app.db';
const SMTP_SETTINGS_ID = 'default_settings';

let db: Database.Database;
let isInitialized = false;

async function createBuildTimeSchema(tempDb: Database.Database) {
  // Create minimal schema for build time
  tempDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      hashedPassword TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_settings (
      id TEXT PRIMARY KEY,
      rateLimitMaxRequests INTEGER NOT NULL,
      rateLimitWindowMs INTEGER NOT NULL,
      maxPayloadSize INTEGER NOT NULL,
      logRetentionDays INTEGER NOT NULL,
      apiRateLimitEnabled INTEGER NOT NULL,
      webhookRateLimitEnabled INTEGER NOT NULL,
      ipWhitelist TEXT NOT NULL,
      enableDetailedErrorLogs INTEGER NOT NULL
    );

    -- Insert dummy admin user for build
    INSERT OR IGNORE INTO users (id, email, name, hashedPassword, isAdmin, createdAt, updatedAt)
    VALUES ('build-admin', 'admin@build.local', 'Build Admin', 'dummy-hash', 1, '2025-01-01', '2025-01-01');

    -- Insert dummy security settings for build
    INSERT OR IGNORE INTO security_settings (
      id, rateLimitMaxRequests, rateLimitWindowMs, maxPayloadSize, 
      logRetentionDays, apiRateLimitEnabled, webhookRateLimitEnabled, 
      ipWhitelist, enableDetailedErrorLogs
    ) VALUES (
      'default_security_settings', 100, 60000, 10485760, 
      30, 1, 0, '[]', 0
    );
  `);
  return tempDb;
}

export async function getDB(): Promise<Database.Database> {
  if (!db) {
    try {
      // During build phase, use in-memory database with minimal schema
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        const tempDb = new Database(':memory:');
        await createBuildTimeSchema(tempDb);
        return tempDb;
      }

      db = new Database(DB_PATH, { /* verbose: console.log */ });
      db.pragma('journal_mode = WAL');
      
      // Only run initialization once
      if (!isInitialized) {
        await initializeDBSchema();
        isInitialized = true;
      }
    } catch (error) {
      // During development or when database is not accessible
      if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build') {
        console.warn('Database not accessible, using temporary in-memory database');
        const tempDb = new Database(':memory:');
        await createBuildTimeSchema(tempDb);
        return tempDb;
      } else {
        throw error;
      }
    }
  }
  return db;
}

// Modified to use migration system
async function initializeDBSchema() {
  try {
    // Run migrations on application startup
    // Note: For a production environment, you might want to run migrations
    // separately from your application startup (using npm run migrate)
    
    // Only run migrations in development
    if (process.env.NODE_ENV === 'development') {
      // Dynamic import to avoid bundling migrations in Next.js build
      const { runMigrations } = await import('../migrations');
      await runMigrations();
    }
    
    // For production, migrations should be run separately using:
    // npm run migrate
    
  } catch (error) {
    console.error('Failed to run migrations during app startup:', error);
    // Don't throw - app should continue as migration CLI can be used to resolve issues
  }
}

async function createInitialAdminUserIfNotExists() {
  const dbInstance = await getDB();
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME || 'Admin User';

  if (!adminEmail || !adminPassword) {
    console.log('Initial admin user environment variables not set. Skipping creation.');
    return;
  }
   if (adminPassword === "changeme" || adminPassword.length < 8) {
    console.warn("WARNING: Initial admin password is 'changeme' or too short. Please set a strong, unique password in your .env file for INITIAL_ADMIN_PASSWORD.");
  }

  const stmt = dbInstance.prepare('SELECT id FROM users WHERE email = ?');
  const existingAdmin = stmt.get(adminEmail);

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const now = new Date().toISOString();
    const userId = uuidv4();
    const insertStmt = dbInstance.prepare(
      'INSERT INTO users (id, email, name, hashedPassword, isAdmin, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertStmt.run(userId, adminEmail, adminName, hashedPassword, 1, now, now);
    console.log(`Initial admin user ${adminEmail} created.`);
    
    // Create default tenant for admin user with owner role
    try {
      const defaultTenantId = uuidv4();
      const tenantStmt = dbInstance.prepare(`
        INSERT INTO tenants (id, name, slug, plan, maxEndpoints, maxIntegrations, maxRequestsPerMonth, enabled, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      tenantStmt.run(
        defaultTenantId,
        'Default Tenant',
        'default',
        'free',
        5,
        10,
        10000,
        1,
        now,
        now
      );
      
      // Add admin user to default tenant as owner
      const tenantUserStmt = dbInstance.prepare(`
        INSERT INTO tenant_users (id, tenantId, userId, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      tenantUserStmt.run(
        uuidv4(),
        defaultTenantId,
        userId,
        'owner',
        now,
        now
      );
      
      console.log(`Default tenant created and admin user assigned as owner.`);
    } catch (error) {
      console.error('Failed to create default tenant for admin user:', error);
    }
    
    // Create default notification preferences for the admin user
    try {
      const { ensureNotificationPreferences } = await import('./notification-preferences');
      await ensureNotificationPreferences(userId);
      console.log(`Default notification preferences created for admin user.`);
    } catch (error) {
      console.error('Failed to create notification preferences for admin user:', error);
    }
  }
}

// Initialize the database when the module is first imported
let initPromise: Promise<void> | null = null;

export async function initializeDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      await getDB();
      await createInitialAdminUserIfNotExists();
    })();
  }
  return initPromise;
}

// --- User CRUD ---
export async function getUserByEmail(email: string): Promise<(User & { hashedPassword?: string }) | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const row = stmt.get(email) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    hashedPassword: row.hashedPassword as string, 
    isAdmin: !!row.isAdmin,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT id, email, name, isAdmin FROM users WHERE id = ?');
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    isAdmin: !!row.isAdmin,
  };
}

export async function updateUserPassword(userId: string, newHashedPassword: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('UPDATE users SET hashedPassword = ?, updatedAt = ? WHERE id = ?');
  const result = stmt.run(newHashedPassword, new Date().toISOString(), userId);
  return result.changes > 0;
}

export async function updateUserNameDb(userId: string, newName: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('UPDATE users SET name = ?, updatedAt = ? WHERE id = ?');
  const result = stmt.run(newName, new Date().toISOString(), userId);
  return result.changes > 0;
}

export async function updateUserEmailDb(userId: string, newEmail: string): Promise<{ success: boolean; error?: string }> {
  const dbInstance = await getDB();
  const checkStmt = dbInstance.prepare('SELECT id FROM users WHERE email = ? AND id != ?');
  const existingUserWithNewEmail = checkStmt.get(newEmail, userId);

  if (existingUserWithNewEmail) {
    return { success: false, error: "This email address is already in use by another account." };
  }

  const stmt = dbInstance.prepare('UPDATE users SET email = ?, updatedAt = ? WHERE id = ?');
  const result = stmt.run(newEmail, new Date().toISOString(), userId);
  return { success: result.changes > 0 };
}


// --- Password Reset Token CRUD ---

// Rate limiting for password reset requests
const resetAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_RESET_ATTEMPTS = 3;
const RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function createPasswordResetToken(userId: string): Promise<string> {
  const db = await getDB();

  // Get user email for rate limiting
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check rate limit (3 attempts per hour)
  const now = Date.now();
  const attempts = resetAttempts.get(user.email);

  if (attempts && attempts.count >= MAX_RESET_ATTEMPTS && now < attempts.resetTime) {
    const minutesLeft = Math.ceil((attempts.resetTime - now) / 60000);
    throw new Error(`Too many password reset requests. Please try again in ${minutesLeft} minute(s).`);
  }

  // Update or create rate limit entry
  if (!attempts || now >= attempts.resetTime) {
    resetAttempts.set(user.email, { count: 1, resetTime: now + RESET_WINDOW_MS });
  } else {
    resetAttempts.set(user.email, { count: attempts.count + 1, resetTime: attempts.resetTime });
  }

  // Clean up old entries periodically
  if (resetAttempts.size > 1000) {
    for (const [email, attempt] of resetAttempts.entries()) {
      if (now >= attempt.resetTime) {
        resetAttempts.delete(email);
      }
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour expiry
  const stmt = db.prepare(
    'INSERT INTO password_reset_tokens (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)'
  );
  stmt.run(uuidv4(), userId, token, expiresAt);
  return token;
}

export async function getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: string } | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT userId, expiresAt FROM password_reset_tokens WHERE token = ?');
  const row = stmt.get(token) as { userId: string; expiresAt: string } | null;
  return row;
}

export async function deletePasswordResetToken(token: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('DELETE FROM password_reset_tokens WHERE token = ?');
  const result = stmt.run(token);
  return result.changes > 0;
}


// --- Integrations CRUD ---
export async function getIntegrations(tenantId?: string): Promise<Integration[]> {
  const db = await getDB();
  const query = tenantId 
    ? 'SELECT * FROM integrations WHERE tenantId = ? ORDER BY name ASC'
    : 'SELECT * FROM integrations ORDER BY name ASC';
  const stmt = db.prepare(query);
  const rows = tenantId ? stmt.all(tenantId) as Record<string, unknown>[] : stmt.all() as Record<string, unknown>[];
  return Promise.all(rows.map(async (row) => ({
    ...row,
    id: row.id as string,
    name: row.name as string,
    platform: row.platform as Platform,
    enabled: !!row.enabled,
    webhookUrl: await decrypt(row.webhookUrl as string),
    fieldFilterId: (row.fieldFilterId as string) || undefined,
    userId: (row.userId as string) || undefined
  })));
}

export async function getIntegrationById(id: string): Promise<Integration | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM integrations WHERE id = ?');
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    platform: row.platform as Platform,
    webhookUrl: await decrypt(row.webhookUrl as string),
    enabled: !!row.enabled,
    fieldFilterId: row.fieldFilterId ? String(row.fieldFilterId) : undefined,
    userId: row.userId ? String(row.userId) : undefined
  };
}

export async function addIntegration(integration: Omit<Integration, 'id'>, userId: string, tenantId?: string): Promise<Integration> {
  const db = await getDB();
  const newIntegration: Integration = { id: uuidv4(), ...integration };
  const encryptedWebhookUrl = await encrypt(newIntegration.webhookUrl);
  const stmt = db.prepare(
    'INSERT INTO integrations (id, name, platform, webhookUrl, enabled, fieldFilterId, createdAt, userId, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    newIntegration.id,
    newIntegration.name,
    newIntegration.platform,
    encryptedWebhookUrl,
    newIntegration.enabled ? 1 : 0,
    newIntegration.fieldFilterId || null,
    new Date().toISOString(),
    userId,
    tenantId || null
  );

  // Log audit event
  const { logSecurityEvent } = await import('./audit-log');
  await logSecurityEvent('integration_created', {
    userId,
    tenantId: tenantId || undefined,
    details: {
      integrationId: newIntegration.id,
      integrationName: newIntegration.name,
      platform: newIntegration.platform
    }
  });

  const fetchedIntegration = await getIntegrationById(newIntegration.id);
  return fetchedIntegration!;
}

export async function updateIntegration(id: string, integration: Partial<Omit<Integration, 'id'>>, userId?: string, tenantId?: string): Promise<Integration | null> {
  const db = await getDB();
  const existing = await getIntegrationById(id);
  if (!existing) return null;

  const dataToSave = { ...existing, ...integration, id };
  const encryptedWebhookUrl = await encrypt(dataToSave.webhookUrl);

  const stmt = db.prepare(
    'UPDATE integrations SET name = ?, platform = ?, webhookUrl = ?, enabled = ?, fieldFilterId = ?, userId = ? WHERE id = ?'
  );
  stmt.run(
    dataToSave.name,
    dataToSave.platform,
    encryptedWebhookUrl,
    dataToSave.enabled ? 1 : 0,
    dataToSave.fieldFilterId || null,
    dataToSave.userId || null,
    id
  );

  // Log audit event
  if (userId) {
    const { logSecurityEvent } = await import('./audit-log');
    await logSecurityEvent('integration_updated', {
      userId,
      tenantId: tenantId || undefined,
      details: {
        integrationId: id,
        integrationName: dataToSave.name,
        changes: integration
      }
    });
  }

  const updatedData = await getIntegrationById(id); 
  return updatedData;
}

export async function deleteIntegration(id: string, userId?: string, tenantId?: string): Promise<boolean> {
  const db = await getDB();
  const existing = await getIntegrationById(id);
  if (!existing) return false;

  // Log audit event before deletion
  if (userId) {
    const { logSecurityEvent } = await import('./audit-log');
    await logSecurityEvent('integration_deleted', {
      userId,
      tenantId: tenantId || undefined,
      details: {
        integrationId: id,
        integrationName: existing.name,
        platform: existing.platform
      }
    });
  }

  const stmt = db.prepare('DELETE FROM integrations WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// --- API Endpoints CRUD ---
export async function getApiEndpoints(tenantId?: string): Promise<ApiEndpointConfig[]> {
  const db = await getDB();
  const query = tenantId 
    ? 'SELECT * FROM api_endpoints WHERE tenantId = ? ORDER BY name ASC'
    : 'SELECT * FROM api_endpoints ORDER BY name ASC';
  const stmt = db.prepare(query);
  const rows = tenantId ? stmt.all(tenantId) as Record<string, unknown>[] : stmt.all() as Record<string, unknown>[];
  return rows.map(ep => ({
    id: ep.id as string,
    name: ep.name as string,
    path: ep.path as string,
    createdAt: ep.createdAt as string,
    associatedIntegrationIds: JSON.parse(ep.associatedIntegrationIds as string || '[]'),
    ipWhitelist: JSON.parse(ep.ipWhitelist as string || '[]')
  }));
}

export async function getApiEndpointById(id: string): Promise<ApiEndpointConfig | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM api_endpoints WHERE id = ?');
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? {
    id: row.id as string,
    name: row.name as string,
    path: row.path as string,
    createdAt: row.createdAt as string,
    associatedIntegrationIds: JSON.parse(row.associatedIntegrationIds as string || '[]'),
    ipWhitelist: JSON.parse(row.ipWhitelist as string || '[]')
  } : null;
}

export async function getApiEndpointByPath(path: string): Promise<ApiEndpointConfig | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM api_endpoints WHERE path = ?');
  const row = stmt.get(path) as Record<string, unknown> | undefined;
  return row ? {
    id: row.id as string,
    name: row.name as string,
    path: row.path as string,
    createdAt: row.createdAt as string,
    associatedIntegrationIds: JSON.parse(row.associatedIntegrationIds as string || '[]'),
    ipWhitelist: JSON.parse(row.ipWhitelist as string || '[]'),
    tenantId: row.tenantId as string | undefined
  } : null;
}

export async function addApiEndpoint(endpoint: Omit<ApiEndpointConfig, 'id' | 'createdAt' | 'path'>, tenantId?: string, userId?: string): Promise<ApiEndpointConfig> {
  const db = await getDB();
  const newEndpoint: ApiEndpointConfig = {
    id: uuidv4(),
    path: uuidv4(), // Generate a secure random UUID for the path
    ...endpoint,
    associatedIntegrationIds: endpoint.associatedIntegrationIds || [],
    ipWhitelist: endpoint.ipWhitelist || [],
    createdAt: new Date().toISOString(),
  };
  const stmt = db.prepare(
    'INSERT INTO api_endpoints (id, name, path, associatedIntegrationIds, ipWhitelist, createdAt, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    newEndpoint.id,
    newEndpoint.name,
    newEndpoint.path,
    JSON.stringify(newEndpoint.associatedIntegrationIds),
    JSON.stringify(newEndpoint.ipWhitelist),
    newEndpoint.createdAt,
    tenantId || null
  );

  // Log audit event
  if (userId) {
    const { logSecurityEvent } = await import('./audit-log');
    await logSecurityEvent('api_endpoint_created', {
      userId,
      tenantId: tenantId || undefined,
      details: {
        endpointId: newEndpoint.id,
        endpointName: newEndpoint.name,
        endpointPath: newEndpoint.path
      }
    });
  }

   return {
    ...newEndpoint,
    associatedIntegrationIds: newEndpoint.associatedIntegrationIds,
    ipWhitelist: newEndpoint.ipWhitelist
  };
}

export async function updateApiEndpoint(id: string, endpoint: Partial<Omit<ApiEndpointConfig, 'id' | 'createdAt' | 'path'>>, userId?: string, tenantId?: string): Promise<ApiEndpointConfig | null> {
  const db = await getDB();
  const existing = await getApiEndpointById(id); 
  if (!existing) return null;

  const updatedEndpointData = { ...existing, ...endpoint, id };

  const stmt = db.prepare(
    'UPDATE api_endpoints SET name = ?, associatedIntegrationIds = ?, ipWhitelist = ? WHERE id = ?'
  );
  stmt.run(
    updatedEndpointData.name,
    JSON.stringify(updatedEndpointData.associatedIntegrationIds || []), // Store as JSON string
    JSON.stringify(updatedEndpointData.ipWhitelist || []), // Store as JSON string
    id
  );

  // Log audit event
  if (userId) {
    const { logSecurityEvent } = await import('./audit-log');
    await logSecurityEvent('api_endpoint_updated', {
      userId,
      tenantId: tenantId || undefined,
      details: {
        endpointId: id,
        endpointName: updatedEndpointData.name,
        changes: endpoint
      }
    });
  }

  return getApiEndpointById(id); 
}

export async function deleteApiEndpoint(id: string, userId?: string, tenantId?: string): Promise<boolean> {
  const db = await getDB();
  const existing = await getApiEndpointById(id);
  if (!existing) return false;

  // Log audit event before deletion
  if (userId) {
    const { logSecurityEvent } = await import('./audit-log');
    await logSecurityEvent('api_endpoint_deleted', {
      userId,
      tenantId: tenantId || undefined,
      details: {
        endpointId: id,
        endpointName: existing.name,
        endpointPath: existing.path
      }
    });
  }
  const stmt = db.prepare('DELETE FROM api_endpoints WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// --- Request Logs ---
const MAX_LOG_ENTRIES = 50;

export async function getRequestLogs(tenantId?: string): Promise<LogEntry[]> {
  const db = await getDB();
  const query = tenantId 
    ? 'SELECT * FROM request_logs WHERE tenantId = ? ORDER BY timestamp DESC LIMIT ?'
    : 'SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT ?';
  const stmt = db.prepare(query);
  const rows = tenantId 
    ? stmt.all(tenantId, MAX_LOG_ENTRIES) as Record<string, unknown>[]
    : stmt.all(MAX_LOG_ENTRIES) as Record<string, unknown>[];

  console.log('Raw request logs:', rows);

  return Promise.all(rows.map(async (row) => {
    try {
      const decryptedHeaders = await decrypt(row.incomingRequestHeaders as string);
      const decryptedIntegrations = await decrypt(row.integrationAttempts as string);
      const decryptedBodyRaw = await decrypt(row.incomingRequestBodyRaw as string);
      
      console.log('Decrypted integrations for log:', {
        logId: row.id,
        integrations: JSON.parse(decryptedIntegrations || '[]')
      });
      
      return {
        id: row.id as string,
        timestamp: row.timestamp as string,
        apiEndpointId: row.apiEndpointId as string,
        apiEndpointName: row.apiEndpointName as string,
        apiEndpointPath: row.apiEndpointPath as string,
        fieldFilterId: row.fieldFilterId ? String(row.fieldFilterId) : undefined,
        userId: row.userId ? String(row.userId) : undefined,
        incomingRequest: {
          ip: row.incomingRequestIp as string | null,
          method: row.incomingRequestMethod as string,
          headers: JSON.parse(decryptedHeaders || '{}'),
          bodyRaw: decryptedBodyRaw,
        },
        processingSummary: {
          overallStatus: row.processingOverallStatus as 'success' | 'partial_failure' | 'total_failure' | 'no_integrations_triggered',
          message: row.processingMessage as string,
        },
        integrations: JSON.parse(decryptedIntegrations || '[]'),
      };
    } catch (error) {
      console.error('Error processing log entry:', error, row);
      return {
        id: row.id as string,
        timestamp: row.timestamp as string,
        apiEndpointId: row.apiEndpointId as string,
        apiEndpointName: row.apiEndpointName as string,
        apiEndpointPath: row.apiEndpointPath as string,
        fieldFilterId: undefined,
        userId: undefined,
        incomingRequest: {
          ip: null,
          method: 'UNKNOWN',
          headers: {},
          bodyRaw: '',
        },
        processingSummary: {
          overallStatus: 'total_failure',
          message: 'Failed to decrypt log entry',
        },
        integrations: [],
      };
    }
  }));
}

export async function addRequestLog(log: Omit<LogEntry, 'id' | 'timestamp'>): Promise<LogEntry> {
  const db = await getDB();
  const newLog: LogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...log,
  };

  const encryptedHeaders = await encrypt(JSON.stringify(newLog.incomingRequest.headers || {}));
  const encryptedBodyRaw = await encrypt(newLog.incomingRequest.bodyRaw);
  const encryptedIntegrations = await encrypt(JSON.stringify(newLog.integrations || []));

  const stmt = db.prepare(
    `INSERT INTO request_logs (
      id, timestamp, apiEndpointId, apiEndpointName, apiEndpointPath,
      fieldFilterId, userId,
      incomingRequestIp, incomingRequestMethod, incomingRequestHeaders, incomingRequestBodyRaw,
      processingOverallStatus, processingMessage, integrationAttempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  
  stmt.run(
    newLog.id,
    newLog.timestamp,
    newLog.apiEndpointId,
    newLog.apiEndpointName,
    newLog.apiEndpointPath,
    newLog.fieldFilterId || null,
    newLog.userId || null,
    newLog.incomingRequest.ip,
    newLog.incomingRequest.method,
    encryptedHeaders,
    encryptedBodyRaw,
    newLog.processingSummary.overallStatus,
    newLog.processingSummary.message,
    encryptedIntegrations
  );

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM request_logs');
  const { count } = countStmt.get() as { count: number };
  if (count > MAX_LOG_ENTRIES) {
    const deleteStmt = db.prepare(
      'DELETE FROM request_logs WHERE id IN (SELECT id FROM request_logs ORDER BY timestamp ASC LIMIT ?)'
    );
    deleteStmt.run(Math.max(0, count - MAX_LOG_ENTRIES));
  }

  const decryptedLogHeaders = await decrypt(encryptedHeaders);
  const decryptedLogBodyRaw = await decrypt(encryptedBodyRaw);
  const decryptedLogIntegrations = await decrypt(encryptedIntegrations);

  return {
      ...newLog,
      incomingRequest: {
          ...newLog.incomingRequest,
          headers: JSON.parse(decryptedLogHeaders || '{}'),
          bodyRaw: decryptedLogBodyRaw,
      },
      integrations: JSON.parse(decryptedLogIntegrations || '[]'),
  };
}

export async function deleteRequestLog(logId: string): Promise<void> {
  const db = await getDB();
  const stmt = db.prepare('DELETE FROM request_logs WHERE id = ?');
  stmt.run(logId);
}

export async function deleteAllRequestLogs(): Promise<void> {
  const db = await getDB();
  const stmt = db.prepare('DELETE FROM request_logs');
  stmt.run();
}

// Helper for dashboard stats
export async function getDashboardStats(tenantId?: string): Promise<{ 
    activeIntegrationsCount: number; 
    relayedNotificationsCount: number;
    apiEndpointsCount: number;
    apiEndpointsRequestsCount: number;
    outboundSuccessCount: number;
    outboundFailureCount: number;
    outboundSuccessRate: number;
    totalOutboundAttempts: number;
}> {
    const db = await getDB();
    
    try {
        // Get active integrations - explicitly convert to number
        const integrationsQuery = tenantId 
            ? 'SELECT COUNT(*) as count FROM integrations WHERE enabled = 1 AND tenantId = ?'
            : 'SELECT COUNT(*) as count FROM integrations WHERE enabled = 1';
        const activeIntegrationsCountResult = tenantId 
            ? db.prepare(integrationsQuery).get(tenantId) as { count: number }
            : db.prepare(integrationsQuery).get() as { count: number };
        const activeIntegrationsCount = Number(activeIntegrationsCountResult.count);
        console.log('Active integrations count:', activeIntegrationsCount);
    
        // Get active endpoints and requests - explicitly convert to number
        const endpointsQuery = tenantId 
            ? 'SELECT COUNT(*) as count FROM api_endpoints WHERE tenantId = ?'
            : 'SELECT COUNT(*) as count FROM api_endpoints';
        const activeEndpointsResult = tenantId 
            ? db.prepare(endpointsQuery).get(tenantId) as { count: number }
            : db.prepare(endpointsQuery).get() as { count: number };
        const activeEndpointsCount = Number(activeEndpointsResult.count);
        
        const logsQuery = tenantId 
            ? 'SELECT COUNT(*) as count FROM request_logs WHERE tenantId = ?'
            : 'SELECT COUNT(*) as count FROM request_logs';
        const apiEndpointsRequestsResult = tenantId 
            ? db.prepare(logsQuery).get(tenantId) as { count: number }
            : db.prepare(logsQuery).get() as { count: number };
        const apiEndpointsRequestsCount = Number(apiEndpointsRequestsResult.count);
    
        // Calculate outbound request metrics by analyzing integration attempts in logs
        const logs = await getRequestLogs(tenantId); // Get recent logs (last 50) filtered by tenant
    
        let totalOutboundAttempts = 0;
        let outboundSuccessCount = 0;
        let outboundFailureCount = 0;
    
        console.log('Processing logs:', logs);
    
        logs.forEach((log, index) => {
            if (!log?.integrations || !Array.isArray(log.integrations)) {
                console.log(`Skipping log ${index}: No valid integrations array`);
                return;
            }
            
            console.log(`Processing log ${index}:`, {
                id: log.id,
                status: log.processingSummary?.overallStatus,
                integrationsCount: log.integrations.length
            });
            
            log.integrations.forEach((attempt, attemptIndex) => {
                if (!attempt?.status) {
                    console.log(`Skipping attempt ${attemptIndex} in log ${index}: Missing required fields`);
                    return;
                }

                // Only count attempts that weren't skipped due to being disabled
                if (attempt.status !== 'skipped_disabled') {
                  if (attempt.status === 'success') {
                    outboundSuccessCount++;
                    totalOutboundAttempts++;
                    console.log(`Counted success in log ${index}, new totals:`, {
                        successCount: outboundSuccessCount,
                        totalAttempts: totalOutboundAttempts
                    });
                  } else if (attempt.status === 'failed_transformation' || attempt.status === 'failed_relay') {
                    outboundFailureCount++;
                    totalOutboundAttempts++;
                    console.log(`Counted failure in log ${index}, new totals:`, {
                        failureCount: outboundFailureCount,
                        totalAttempts: totalOutboundAttempts
                    });
                  }
                } else {
                  console.log(`Skipping disabled attempt in log ${index}`);
                }
            });
        });
    
        // Calculate success rate
        const outboundSuccessRate = totalOutboundAttempts > 0 
            ? Math.round((outboundSuccessCount / totalOutboundAttempts) * 100) 
            : 0;
    
        console.log('Dashboard Stats:', {
            successCount: outboundSuccessCount,
            totalAttempts: totalOutboundAttempts,
            successRate: outboundSuccessRate
        });
    
        return {
            activeIntegrationsCount,
            relayedNotificationsCount: apiEndpointsRequestsCount,
            apiEndpointsCount: activeEndpointsCount,
            apiEndpointsRequestsCount,
            outboundSuccessCount,
            outboundFailureCount,
            outboundSuccessRate,
            totalOutboundAttempts,
        };
    } catch (error) {
        console.error('Error calculating dashboard stats:', error);
        throw error;
    }
}

// --- SMTP Settings ---
export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM smtp_settings WHERE id = ?');
  const row = stmt.get(SMTP_SETTINGS_ID) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    host: row.host as string,
    port: Number(row.port),
    user: row.user as string,
    password: row.password ? await decrypt(row.password as string) : undefined,
    secure: !!row.secure,
    fromEmail: row.fromEmail as string,
    appBaseUrl: row.appBaseUrl as string
  };
}

export async function saveSmtpSettings(settings: SmtpSettings): Promise<void> {
  const db = await getDB();
  const encryptedPassword = settings.password ? await encrypt(settings.password) : '';
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO smtp_settings (
      id, host, port, user, password, secure, fromEmail, appBaseUrl
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    SMTP_SETTINGS_ID,
    settings.host,
    settings.port,
    settings.user,
    encryptedPassword,
    settings.secure ? 1 : 0,
    settings.fromEmail,
    settings.appBaseUrl
  );
}

// Field Filter Functions

/**
 * Create a new field filter configuration
 */
export async function createFieldFilter(data: Omit<FieldFilterConfig, 'id' | 'createdAt' | 'updatedAt'>, tenantId?: string): Promise<FieldFilterConfig> {
  const db = await getDB();
  
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(
    `INSERT INTO field_filters (
      id, name, included_fields, excluded_fields, description, sample_data, created_at, updated_at, tenantId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  
  stmt.run(
    id,
    data.name,
    JSON.stringify(data.includedFields),
    JSON.stringify(data.excludedFields),
    data.description || null,
    data.sampleData || null,
    now,
    now,
    tenantId || null
  );
  
  return {
    id,
    name: data.name,
    includedFields: data.includedFields,
    excludedFields: data.excludedFields,
    description: data.description,
    sampleData: data.sampleData,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Get a field filter by ID
 */
export async function getFieldFilter(id: string): Promise<FieldFilterConfig | null> {
  const db = await getDB();
  
  const stmt = db.prepare(`SELECT * FROM field_filters WHERE id = ?`);
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    id: row.id as string,
    name: row.name as string,
    includedFields: JSON.parse(row.included_fields as string),
    excludedFields: JSON.parse(row.excluded_fields as string),
    description: row.description as string | undefined,
    sampleData: row.sample_data as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

/**
 * Get all field filters
 */
export async function getFieldFilters(tenantId?: string): Promise<FieldFilterConfig[]> {
  const db = await getDB();
  
  const query = tenantId 
    ? 'SELECT * FROM field_filters WHERE tenantId = ? ORDER BY name ASC'
    : 'SELECT * FROM field_filters ORDER BY name ASC';
  const stmt = db.prepare(query);
  const rows = tenantId ? stmt.all(tenantId) as Record<string, unknown>[] : stmt.all() as Record<string, unknown>[];
  
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    includedFields: JSON.parse(row.included_fields as string),
    excludedFields: JSON.parse(row.excluded_fields as string),
    description: row.description as string | undefined,
    sampleData: row.sample_data as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }));
}

/**
 * Update a field filter
 */
export async function updateFieldFilter(
  id: string, 
  data: Partial<Omit<FieldFilterConfig, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<FieldFilterConfig | null> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  // Build update query dynamically based on provided fields
  const updateFields: string[] = ['updated_at = ?'];
  const params: Array<string | number | null> = [now];
  
  if (data.name !== undefined) {
    updateFields.push('name = ?');
    params.push(data.name);
  }
  
  if (data.includedFields !== undefined) {
    updateFields.push('included_fields = ?');
    params.push(JSON.stringify(data.includedFields));
  }
  
  if (data.excludedFields !== undefined) {
    updateFields.push('excluded_fields = ?');
    params.push(JSON.stringify(data.excludedFields));
  }
  
  if (data.description !== undefined) {
    updateFields.push('description = ?');
    params.push(data.description);
  }
  
  if (data.sampleData !== undefined) {
    updateFields.push('sample_data = ?');
    params.push(data.sampleData);
  }
  
  // Add ID to params
  params.push(id);
  
  const stmt = db.prepare(
    `UPDATE field_filters SET ${updateFields.join(', ')} WHERE id = ?`
  );
  
  stmt.run(...params);
  
  return getFieldFilter(id);
}

/**
 * Delete a field filter
 */
export async function deleteFieldFilter(id: string): Promise<boolean> {
  const db = await getDB();
  
  // Remove any references in integrations
  const updateStmt = db.prepare(
    `UPDATE integrations SET fieldFilterId = NULL WHERE fieldFilterId = ?`
  );
  updateStmt.run(id);
  
  // Delete the filter
  const deleteStmt = db.prepare(
    `DELETE FROM field_filters WHERE id = ?`
  );
  const result = deleteStmt.run(id);

  return result.changes > 0;
}

/**
 * Get a request log by ID
 */
export async function getRequestLogById(logId: string): Promise<LogEntry | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM request_logs WHERE id = ?');
  const row = stmt.get(logId) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  try {
    const decryptedHeaders = await decrypt(row.incomingRequestHeaders as string);
    const decryptedIntegrations = await decrypt(row.integrationAttempts as string);
    const decryptedBodyRaw = await decrypt(row.incomingRequestBodyRaw as string);
    
    return {
      id: row.id as string,
      timestamp: row.timestamp as string,
      apiEndpointId: row.apiEndpointId as string,
      apiEndpointName: row.apiEndpointName as string,
      apiEndpointPath: row.apiEndpointPath as string,
      fieldFilterId: row.fieldFilterId ? String(row.fieldFilterId) : undefined,
      userId: row.userId ? String(row.userId) : undefined,
      incomingRequest: {
        ip: row.incomingRequestIp as string | null,
        method: row.incomingRequestMethod as string,
        headers: JSON.parse(decryptedHeaders || '{}'),
        bodyRaw: decryptedBodyRaw,
      },
      processingSummary: {
        overallStatus: row.processingOverallStatus as 'success' | 'partial_failure' | 'total_failure' | 'no_integrations_triggered',
        message: row.processingMessage as string,
      },
      integrations: JSON.parse(decryptedIntegrations || '[]'),
    };
  } catch (error) {
    console.error('Error processing log entry:', error);
    return null;
  }
}

// --- Tenant Management ---
import type { Tenant, TenantUser, TenantWithRole, TenantPlan, TenantUserRole } from './types';

export async function createTenant(data: {
  name: string;
  slug: string;
  domain?: string;
  plan?: TenantPlan;
  maxEndpoints?: number;
  maxIntegrations?: number;
  maxRequestsPerMonth?: number;
}): Promise<Tenant> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  const tenant: Tenant = {
    id: uuidv4(),
    name: data.name,
    slug: data.slug,
    domain: data.domain || undefined,
    plan: data.plan || 'free',
    maxEndpoints: data.maxEndpoints || 5,
    maxIntegrations: data.maxIntegrations || 10,
    maxRequestsPerMonth: data.maxRequestsPerMonth || 10000,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  const stmt = db.prepare(`
    INSERT INTO tenants (id, name, slug, domain, plan, maxEndpoints, maxIntegrations, maxRequestsPerMonth, enabled, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    tenant.id,
    tenant.name,
    tenant.slug,
    tenant.domain || null,
    tenant.plan,
    tenant.maxEndpoints,
    tenant.maxIntegrations,
    tenant.maxRequestsPerMonth,
    tenant.enabled ? 1 : 0,
    tenant.createdAt,
    tenant.updatedAt
  );

  return tenant;
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM tenants WHERE id = ?');
  const row = stmt.get(tenantId) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    domain: row.domain as string | undefined,
    plan: row.plan as TenantPlan,
    maxEndpoints: row.maxEndpoints as number,
    maxIntegrations: row.maxIntegrations as number,
    maxRequestsPerMonth: row.maxRequestsPerMonth as number,
    enabled: !!row.enabled,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    expiresAt: row.expiresAt as string | undefined,
  };
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM tenants WHERE slug = ?');
  const row = stmt.get(slug) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    domain: row.domain as string | undefined,
    plan: row.plan as TenantPlan,
    maxEndpoints: row.maxEndpoints as number,
    maxIntegrations: row.maxIntegrations as number,
    maxRequestsPerMonth: row.maxRequestsPerMonth as number,
    enabled: !!row.enabled,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    expiresAt: row.expiresAt as string | undefined,
  };
}

export async function getAllTenants(): Promise<Tenant[]> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM tenants ORDER BY createdAt DESC');
  const rows = stmt.all() as Record<string, unknown>[];
  
  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    domain: row.domain as string | undefined,
    plan: row.plan as TenantPlan,
    maxEndpoints: row.maxEndpoints as number,
    maxIntegrations: row.maxIntegrations as number,
    maxRequestsPerMonth: row.maxRequestsPerMonth as number,
    enabled: !!row.enabled,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    expiresAt: row.expiresAt as string | undefined,
  }));
}

export async function getTenantsForUser(userId: string): Promise<TenantWithRole[]> {
  const db = await getDB();
  const stmt = db.prepare(`
    SELECT t.*, tu.role as userRole
    FROM tenants t
    INNER JOIN tenant_users tu ON t.id = tu.tenantId
    WHERE tu.userId = ?
    ORDER BY t.name ASC
  `);
  const rows = stmt.all(userId) as Record<string, unknown>[];
  
  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    domain: row.domain as string | undefined,
    plan: row.plan as TenantPlan,
    maxEndpoints: row.maxEndpoints as number,
    maxIntegrations: row.maxIntegrations as number,
    maxRequestsPerMonth: row.maxRequestsPerMonth as number,
    enabled: !!row.enabled,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    expiresAt: row.expiresAt as string | undefined,
    userRole: row.userRole as TenantUserRole,
  }));
}

export async function updateTenant(tenantId: string, data: Partial<{
  name: string;
  slug: string;
  domain: string;
  plan: TenantPlan;
  maxEndpoints: number;
  maxIntegrations: number;
  maxRequestsPerMonth: number;
  enabled: boolean;
  expiresAt: string;
}>): Promise<boolean> {
  const db = await getDB();
  const updates: string[] = [];
  const values: unknown[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
  });

  if (updates.length === 0) return false;

  updates.push('updatedAt = ?');
  values.push(new Date().toISOString());
  values.push(tenantId);

  const stmt = db.prepare(`
    UPDATE tenants 
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  const result = stmt.run(...values);
  return result.changes > 0;
}

export async function deleteTenant(tenantId: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('DELETE FROM tenants WHERE id = ?');
  const result = stmt.run(tenantId);
  return result.changes > 0;
}

// --- Tenant User Management ---

export async function addUserToTenant(
  tenantId: string,
  userId: string,
  role?: TenantUserRole,
  customRoleId?: string | null
): Promise<TenantUser> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  const tenantUser: TenantUser = {
    id: uuidv4(),
    tenantId,
    userId,
    role: role || 'viewer',
    createdAt: now,
    updatedAt: now,
  };

  const stmt = db.prepare(`
    INSERT INTO tenant_users (id, tenantId, userId, role, customRoleId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    tenantUser.id,
    tenantUser.tenantId,
    tenantUser.userId,
    customRoleId ? null : tenantUser.role, // If custom role, set built-in role to null
    customRoleId || null,
    tenantUser.createdAt,
    tenantUser.updatedAt
  );

  return tenantUser;
}

export async function getUserRoleInTenant(tenantId: string, userId: string): Promise<TenantUserRole | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT role FROM tenant_users WHERE tenantId = ? AND userId = ?');
  const row = stmt.get(tenantId, userId) as { role: TenantUserRole } | undefined;
  return row?.role || null;
}

export async function updateUserRoleInTenant(
  tenantId: string,
  userId: string,
  role: TenantUserRole,
  customRoleId?: string | null
): Promise<boolean> {
  const db = await getDB();
  
  // If customRoleId is provided, update it; otherwise update the built-in role column
  if (customRoleId !== undefined) {
    const stmt = db.prepare(`
      UPDATE tenant_users 
      SET customRoleId = ?, role = NULL, updatedAt = ?
      WHERE tenantId = ? AND userId = ?
    `);
    const result = stmt.run(customRoleId, new Date().toISOString(), tenantId, userId);
    return result.changes > 0;
  } else {
    const stmt = db.prepare(`
      UPDATE tenant_users 
      SET role = ?, customRoleId = NULL, updatedAt = ?
      WHERE tenantId = ? AND userId = ?
    `);
    const result = stmt.run(role, new Date().toISOString(), tenantId, userId);
    return result.changes > 0;
  }
}

export async function removeUserFromTenant(tenantId: string, userId: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('DELETE FROM tenant_users WHERE tenantId = ? AND userId = ?');
  const result = stmt.run(tenantId, userId);
  return result.changes > 0;
}

export async function getUsersInTenant(tenantId: string): Promise<Array<User & { role: TenantUserRole; createdAt: string }>> {
  const db = await getDB();
  const stmt = db.prepare(`
    SELECT u.id, u.email, u.name, u.isAdmin, tu.role, tu.createdAt
    FROM users u
    INNER JOIN tenant_users tu ON u.id = tu.userId
    WHERE tu.tenantId = ?
    ORDER BY tu.createdAt ASC
  `);
  const rows = stmt.all(tenantId) as Record<string, unknown>[];
  
  return rows.map(row => ({
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    isAdmin: !!row.isAdmin,
    role: row.role as TenantUserRole,
    createdAt: row.createdAt as string,
  }));
}

// ============================================
// TENANT-AWARE QUERY FUNCTIONS
// ============================================

/**
 * Get API endpoints filtered by tenant
 */
export async function getApiEndpointsByTenant(tenantId: string): Promise<ApiEndpointConfig[]> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM api_endpoints WHERE tenantId = ? ORDER BY name ASC');
  const rows = stmt.all(tenantId) as Record<string, unknown>[];
  return rows.map(ep => ({
    id: ep.id as string,
    name: ep.name as string,
    path: ep.path as string,
    createdAt: ep.createdAt as string,
    associatedIntegrationIds: JSON.parse(ep.associatedIntegrationIds as string || '[]'),
    ipWhitelist: JSON.parse(ep.ipWhitelist as string || '[]')
  }));
}

// Tenant-specific helper functions removed - use main functions with tenantId param
// - getIntegrations(tenantId) 
// - getRequestLogs(tenantId)
// - etc.
