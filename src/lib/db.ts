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
    const insertStmt = dbInstance.prepare(
      'INSERT INTO users (id, email, name, hashedPassword, isAdmin, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertStmt.run(uuidv4(), adminEmail, adminName, hashedPassword, 1, now, now);
    console.log(`Initial admin user ${adminEmail} created.`);
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
export async function createPasswordResetToken(userId: string): Promise<string> {
  const db = await getDB();
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
export async function getIntegrations(): Promise<Integration[]> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM integrations ORDER BY name ASC');
  const rows = stmt.all() as Record<string, unknown>[];
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

export async function addIntegration(integration: Omit<Integration, 'id'>, userId: string): Promise<Integration> {
  const db = await getDB();
  const newIntegration: Integration = { id: uuidv4(), ...integration };
  const encryptedWebhookUrl = await encrypt(newIntegration.webhookUrl);
  const stmt = db.prepare(
    'INSERT INTO integrations (id, name, platform, webhookUrl, enabled, fieldFilterId, createdAt, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    newIntegration.id,
    newIntegration.name,
    newIntegration.platform,
    encryptedWebhookUrl,
    newIntegration.enabled ? 1 : 0,
    newIntegration.fieldFilterId || null,
    new Date().toISOString(),
    userId
  );
  const fetchedIntegration = await getIntegrationById(newIntegration.id);
  return fetchedIntegration!;
}

export async function updateIntegration(id: string, integration: Partial<Omit<Integration, 'id'>>): Promise<Integration | null> {
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
  const updatedData = await getIntegrationById(id); 
  return updatedData;
}

export async function deleteIntegration(id: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('DELETE FROM integrations WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// --- API Endpoints CRUD ---
export async function getApiEndpoints(): Promise<ApiEndpointConfig[]> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM api_endpoints ORDER BY name ASC');
  const rows = stmt.all() as Record<string, unknown>[];
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
    ipWhitelist: JSON.parse(row.ipWhitelist as string || '[]')
  } : null;
}

export async function addApiEndpoint(endpoint: Omit<ApiEndpointConfig, 'id' | 'createdAt' | 'path'>): Promise<ApiEndpointConfig> {
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
    'INSERT INTO api_endpoints (id, name, path, associatedIntegrationIds, ipWhitelist, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    newEndpoint.id,
    newEndpoint.name,
    newEndpoint.path,
    JSON.stringify(newEndpoint.associatedIntegrationIds),
    JSON.stringify(newEndpoint.ipWhitelist),
    newEndpoint.createdAt
  );
   return {
    ...newEndpoint,
    associatedIntegrationIds: newEndpoint.associatedIntegrationIds,
    ipWhitelist: newEndpoint.ipWhitelist
  };
}

export async function updateApiEndpoint(id: string, endpoint: Partial<Omit<ApiEndpointConfig, 'id' | 'createdAt' | 'path'>>): Promise<ApiEndpointConfig | null> {
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
  return getApiEndpointById(id); 
}

export async function deleteApiEndpoint(id: string): Promise<boolean> {
  const db = await getDB();
  const stmt = db.prepare('DELETE FROM api_endpoints WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// --- Request Logs ---
const MAX_LOG_ENTRIES = 50;

export async function getRequestLogs(): Promise<LogEntry[]> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT ?');
  const rows = stmt.all(MAX_LOG_ENTRIES) as Record<string, unknown>[];

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
export async function getDashboardStats(): Promise<{ 
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
        const activeIntegrationsCountResult = db.prepare('SELECT COUNT(*) as count FROM integrations WHERE enabled = 1').get() as { count: number };
        const activeIntegrationsCount = Number(activeIntegrationsCountResult.count);
        console.log('Active integrations count:', activeIntegrationsCount);
    
        // Get active endpoints and requests - explicitly convert to number
        const activeEndpointsResult = db.prepare('SELECT COUNT(*) as count FROM api_endpoints').get() as { count: number };
        const activeEndpointsCount = Number(activeEndpointsResult.count);
        
        const apiEndpointsRequestsResult = db.prepare('SELECT COUNT(*) as count FROM request_logs').get() as { count: number };
        const apiEndpointsRequestsCount = Number(apiEndpointsRequestsResult.count);
    
        // Calculate outbound request metrics by analyzing integration attempts in logs
        const logs = await getRequestLogs(); // Get recent logs (last 50)
    
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
export async function createFieldFilter(data: Omit<FieldFilterConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<FieldFilterConfig> {
  const db = await getDB();
  
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(
    `INSERT INTO field_filters (
      id, name, included_fields, excluded_fields, description, sample_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  
  stmt.run(
    id,
    data.name,
    JSON.stringify(data.includedFields),
    JSON.stringify(data.excludedFields),
    data.description || null,
    data.sampleData || null,
    now,
    now
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
export async function getFieldFilters(): Promise<FieldFilterConfig[]> {
  const db = await getDB();
  
  const stmt = db.prepare(`SELECT * FROM field_filters ORDER BY name ASC`);
  const rows = stmt.all() as Record<string, unknown>[];
  
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
