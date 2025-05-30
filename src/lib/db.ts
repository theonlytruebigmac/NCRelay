'use server';
import Database from 'better-sqlite3';
import type { Integration, ApiEndpointConfig, LogEntry, User, SmtpSettings, FieldFilterConfig } from './types';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, decrypt } from './crypto';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { runMigrations } from '../migrations';
import { getPlatformFormat } from './platform-helpers';

const DB_PATH = process.env.NODE_ENV === 'production' ? '/data/app.db' : 'app.db';
const SMTP_SETTINGS_ID = 'default_settings';

let db: Database.Database;
let isInitialized = false;

export async function getDB(): Promise<Database.Database> {
  if (!db) {
    try {
      db = new Database(DB_PATH, { /* verbose: console.log */ });
      db.pragma('journal_mode = WAL');
      
      // Only run initialization once
      if (!isInitialized) {
        await initializeDBSchema();
        isInitialized = true;
      }
    } catch (error) {
      // During build, database might not be accessible - create a dummy database
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Database not accessible during build, creating temporary database');
        db = new Database(':memory:');
        await initializeDBSchema();
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
    await runMigrations();
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
  const row = stmt.get(email) as any;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    hashedPassword: row.hashedPassword, 
    isAdmin: !!row.isAdmin,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT id, email, name, isAdmin FROM users WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
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
  const rows = stmt.all() as any[];
  return Promise.all(rows.map(async (row) => ({
    ...row,
    enabled: !!row.enabled,
    webhookUrl: await decrypt(row.webhookUrl)
  })));
}

export async function getIntegrationById(id: string): Promise<Integration | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM integrations WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    webhookUrl: await decrypt(row.webhookUrl),
    enabled: !!row.enabled,
    fieldFilterId: row.fieldFilterId || undefined
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
    'UPDATE integrations SET name = ?, platform = ?, webhookUrl = ?, enabled = ?, fieldFilterId = ? WHERE id = ?'
  );
  stmt.run(
    dataToSave.name,
    dataToSave.platform,
    encryptedWebhookUrl,
    dataToSave.enabled ? 1 : 0,
    dataToSave.fieldFilterId || null,
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
  const rows = stmt.all() as ApiEndpointConfig[];
   return rows.map(ep => ({
    ...ep,
    associatedIntegrationIds: JSON.parse(ep.associatedIntegrationIds as unknown as string || '[]')
  }));
}

export async function getApiEndpointById(id: string): Promise<ApiEndpointConfig | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM api_endpoints WHERE id = ?');
  const row = stmt.get(id) as ApiEndpointConfig | null;
  return row ? { ...row, associatedIntegrationIds: JSON.parse(row.associatedIntegrationIds as unknown as string || '[]') } : null;
}

export async function getApiEndpointByPath(path: string): Promise<ApiEndpointConfig | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM api_endpoints WHERE path = ?');
  const row = stmt.get(path) as ApiEndpointConfig | null;
  return row ? { ...row, associatedIntegrationIds: JSON.parse(row.associatedIntegrationIds as unknown as string || '[]') } : null;
}

export async function addApiEndpoint(endpoint: Omit<ApiEndpointConfig, 'id' | 'createdAt' | 'path'>): Promise<ApiEndpointConfig> {
  const db = await getDB();
  const newEndpoint: ApiEndpointConfig = {
    id: uuidv4(),
    path: uuidv4(), // Generate a secure random UUID for the path
    ...endpoint,
    associatedIntegrationIds: endpoint.associatedIntegrationIds || [],
    createdAt: new Date().toISOString(),
  };
  const stmt = db.prepare(
    'INSERT INTO api_endpoints (id, name, path, associatedIntegrationIds, createdAt) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(
    newEndpoint.id,
    newEndpoint.name,
    newEndpoint.path,
    JSON.stringify(newEndpoint.associatedIntegrationIds),
    newEndpoint.createdAt
  );
   return {
    ...newEndpoint,
    associatedIntegrationIds: newEndpoint.associatedIntegrationIds
  };
}

export async function updateApiEndpoint(id: string, endpoint: Partial<Omit<ApiEndpointConfig, 'id' | 'createdAt' | 'path'>>): Promise<ApiEndpointConfig | null> {
  const db = await getDB();
  const existing = await getApiEndpointById(id); 
  if (!existing) return null;

  const updatedEndpointData = { ...existing, ...endpoint, id };

  const stmt = db.prepare(
    'UPDATE api_endpoints SET name = ?, associatedIntegrationIds = ? WHERE id = ?'
  );
  stmt.run(
    updatedEndpointData.name,
    JSON.stringify(updatedEndpointData.associatedIntegrationIds || []), // Store as JSON string
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
  const rows = stmt.all(MAX_LOG_ENTRIES) as any[];

  return Promise.all(rows.map(async (row) => {
    const decryptedHeaders = await decrypt(row.incomingRequestHeaders);
    const decryptedIntegrations = await decrypt(row.integrationAttempts);
    const decryptedBodyRaw = await decrypt(row.incomingRequestBodyRaw);
    return {
      id: row.id,
      timestamp: row.timestamp,
      apiEndpointId: row.apiEndpointId,
      apiEndpointName: row.apiEndpointName,
      apiEndpointPath: row.apiEndpointPath,
      incomingRequest: {
        ip: row.incomingRequestIp,
        method: row.incomingRequestMethod,
        headers: JSON.parse(decryptedHeaders || '{}'),
        bodyRaw: decryptedBodyRaw,
      },
      processingSummary: {
        overallStatus: row.processingOverallStatus,
        message: row.processingMessage,
      },
      integrations: JSON.parse(decryptedIntegrations || '[]'),
    };
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
      incomingRequestIp, incomingRequestMethod, incomingRequestHeaders, incomingRequestBodyRaw,
      processingOverallStatus, processingMessage, integrationAttempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    newLog.id,
    newLog.timestamp,
    newLog.apiEndpointId,
    newLog.apiEndpointName,
    newLog.apiEndpointPath,
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
    const activeIntegrationsCountResult = db.prepare('SELECT COUNT(*) as count FROM integrations WHERE enabled = 1').get() as { count: number };
    const totalLogsCountResult = db.prepare('SELECT COUNT(*) as count FROM request_logs').get() as { count: number };
    const apiEndpointsCountResult = db.prepare('SELECT COUNT(*) as count FROM api_endpoints').get() as { count: number };
    
    // Get count of API endpoint requests (request_logs with non-null apiEndpointId)
    const apiEndpointsRequestsCountResult = db.prepare('SELECT COUNT(*) as count FROM request_logs WHERE apiEndpointId IS NOT NULL').get() as { count: number };
    
    // Calculate outbound request metrics by analyzing integration attempts in logs
    const logs = await getRequestLogs(); // Get recent logs (last 50)
    
    let totalOutboundAttempts = 0;
    let outboundSuccessCount = 0;
    let outboundFailureCount = 0;
    
    logs.forEach(log => {
        log.integrations.forEach(attempt => {
            totalOutboundAttempts++;
            if (attempt.status === 'success') {
                outboundSuccessCount++;
            } else if (attempt.status === 'failed_transformation' || attempt.status === 'failed_relay') {
                outboundFailureCount++;
            }
            // Note: skipped attempts (disabled/no_association) are not counted as failures
        });
    });
    
    const outboundSuccessRate = totalOutboundAttempts > 0 
        ? Math.round((outboundSuccessCount / totalOutboundAttempts) * 100) 
        : 0;
    
    return {
        activeIntegrationsCount: activeIntegrationsCountResult.count,
        relayedNotificationsCount: totalLogsCountResult.count,
        apiEndpointsCount: apiEndpointsCountResult.count,
        apiEndpointsRequestsCount: apiEndpointsRequestsCountResult.count,
        outboundSuccessCount,
        outboundFailureCount,
        outboundSuccessRate,
        totalOutboundAttempts,
    };
}

// --- SMTP Settings ---
export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const db = await getDB();
  const stmt = db.prepare('SELECT * FROM smtp_settings WHERE id = ?');
  const row = stmt.get(SMTP_SETTINGS_ID) as any;
  if (!row) return null;
  return {
    ...row,
    password: row.password ? await decrypt(row.password) : undefined,
    secure: !!row.secure,
    port: Number(row.port)
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
  const row = stmt.get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    includedFields: JSON.parse(row.included_fields),
    excludedFields: JSON.parse(row.excluded_fields),
    description: row.description,
    sampleData: row.sample_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get all field filters
 */
export async function getFieldFilters(): Promise<FieldFilterConfig[]> {
  const db = await getDB();
  
  const stmt = db.prepare(`SELECT * FROM field_filters ORDER BY name ASC`);
  const rows = stmt.all() as any[];
  
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    includedFields: JSON.parse(row.included_fields),
    excludedFields: JSON.parse(row.excluded_fields),
    description: row.description,
    sampleData: row.sample_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
  let updateFields: string[] = ['updated_at = ?'];
  let params: any[] = [now];
  
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
  const row = stmt.get(logId) as any;

  if (!row) {
    return null;
  }

  const decryptedHeaders = await decrypt(row.incomingRequestHeaders);
  const decryptedIntegrations = await decrypt(row.integrationAttempts);
  const decryptedBodyRaw = await decrypt(row.incomingRequestBodyRaw);
  
  return {
    id: row.id,
    timestamp: row.timestamp,
    apiEndpointId: row.apiEndpointId,
    apiEndpointName: row.apiEndpointName,
    apiEndpointPath: row.apiEndpointPath,
    incomingRequest: {
      ip: row.incomingRequestIp,
      method: row.incomingRequestMethod,
      headers: JSON.parse(decryptedHeaders || '{}'),
      bodyRaw: decryptedBodyRaw,
    },
    processingSummary: {
      overallStatus: row.processingOverallStatus,
      message: row.processingMessage,
    },
    integrations: JSON.parse(decryptedIntegrations || '[]'),
  };
}
