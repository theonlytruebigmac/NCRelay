
'use server';
import Database from 'better-sqlite3';
import type { Integration, ApiEndpointConfig, LogEntry, User, SmtpSettings } from './types';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, decrypt } from './crypto';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';


const DB_PATH = process.env.NODE_ENV === 'production' ? '/data/app.db' : 'app.db';
const SMTP_SETTINGS_ID = 'default_settings';

let db: Database.Database;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH, { /* verbose: console.log */ });
    db.pragma('journal_mode = WAL');
    initializeDBSchema();
    // createInitialAdminUserIfNotExists is async, call it carefully if needed during init
    // For now, it's called explicitly after getDB() ensures db is initialized
  }
  return db;
}

function initializeDBSchema() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      hashedPassword TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `;

  const createPasswordResetTokensTable = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  const createIntegrationsTable = `
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      webhookUrl TEXT NOT NULL, -- Will be encrypted
      enabled INTEGER NOT NULL,
      targetFormat TEXT NOT NULL
    );
  `;

  const createApiEndpointsTable = `
    CREATE TABLE IF NOT EXISTS api_endpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      associatedIntegrationIds TEXT NOT NULL, -- JSON string array
      createdAt TEXT NOT NULL -- ISO8601 string
    );
  `;

  const createRequestLogsTable = `
    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL, -- ISO8601 string
      apiEndpointId TEXT,
      apiEndpointName TEXT,
      apiEndpointPath TEXT NOT NULL,
      incomingRequestIp TEXT,
      incomingRequestMethod TEXT NOT NULL,
      incomingRequestHeaders TEXT NOT NULL, -- JSON string, will be encrypted
      incomingRequestBodyRaw TEXT NOT NULL, -- Will be encrypted
      processingOverallStatus TEXT NOT NULL,
      processingMessage TEXT NOT NULL,
      integrationAttempts TEXT -- JSON string array of LoggedIntegrationAttempt, will be encrypted
    );
  `;
  
  const createSmtpSettingsTable = `
    CREATE TABLE IF NOT EXISTS smtp_settings (
      id TEXT PRIMARY KEY, -- Should always be 'default_settings'
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      user TEXT NOT NULL,
      password TEXT NOT NULL, -- Encrypted
      secure INTEGER NOT NULL, -- Boolean (0 or 1)
      fromEmail TEXT NOT NULL,
      appBaseUrl TEXT NOT NULL
    );
  `;

  const dbInstance = getDB(); // Ensure db is initialized before exec
  dbInstance.exec(createUsersTable);
  dbInstance.exec(createPasswordResetTokensTable);
  dbInstance.exec(createIntegrationsTable);
  dbInstance.exec(createApiEndpointsTable);
  dbInstance.exec(createRequestLogsTable);
  dbInstance.exec(createSmtpSettingsTable);
}

async function createInitialAdminUserIfNotExists() {
  const dbInstance = getDB();
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

getDB(); 
createInitialAdminUserIfNotExists();

// --- User CRUD ---
export async function getUserByEmail(email: string): Promise<(User & { hashedPassword?: string }) | null> {
  const stmt = getDB().prepare('SELECT * FROM users WHERE email = ?');
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
  const stmt = getDB().prepare('SELECT id, email, name, isAdmin FROM users WHERE id = ?');
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
  const stmt = getDB().prepare('UPDATE users SET hashedPassword = ?, updatedAt = ? WHERE id = ?');
  const result = stmt.run(newHashedPassword, new Date().toISOString(), userId);
  return result.changes > 0;
}

export async function updateUserNameDb(userId: string, newName: string): Promise<boolean> {
  const stmt = getDB().prepare('UPDATE users SET name = ?, updatedAt = ? WHERE id = ?');
  const result = stmt.run(newName, new Date().toISOString(), userId);
  return result.changes > 0;
}

export async function updateUserEmailDb(userId: string, newEmail: string): Promise<{ success: boolean; error?: string }> {
  const dbInstance = getDB();
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
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour expiry
  const stmt = getDB().prepare(
    'INSERT INTO password_reset_tokens (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)'
  );
  stmt.run(uuidv4(), userId, token, expiresAt);
  return token;
}

export async function getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: string } | null> {
  const stmt = getDB().prepare('SELECT userId, expiresAt FROM password_reset_tokens WHERE token = ?');
  const row = stmt.get(token) as { userId: string; expiresAt: string } | null;
  return row;
}

export async function deletePasswordResetToken(token: string): Promise<boolean> {
  const stmt = getDB().prepare('DELETE FROM password_reset_tokens WHERE token = ?');
  const result = stmt.run(token);
  return result.changes > 0;
}


// --- Integrations CRUD ---
export async function getIntegrations(): Promise<Integration[]> {
  const stmt = getDB().prepare('SELECT * FROM integrations ORDER BY name ASC');
  const rows = stmt.all() as any[];
  return Promise.all(rows.map(async (row) => ({
    ...row,
    enabled: !!row.enabled,
    webhookUrl: await decrypt(row.webhookUrl)
  })));
}

export async function getIntegrationById(id: string): Promise<Integration | null> {
  const stmt = getDB().prepare('SELECT * FROM integrations WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return {
    ...row,
    enabled: !!row.enabled,
    webhookUrl: await decrypt(row.webhookUrl)
  };
}

export async function addIntegration(integration: Omit<Integration, 'id'>): Promise<Integration> {
  const newIntegration: Integration = { id: uuidv4(), ...integration };
  const encryptedWebhookUrl = await encrypt(newIntegration.webhookUrl);
  const stmt = getDB().prepare(
    'INSERT INTO integrations (id, name, platform, webhookUrl, enabled, targetFormat) VALUES (?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    newIntegration.id,
    newIntegration.name,
    newIntegration.platform,
    encryptedWebhookUrl,
    newIntegration.enabled ? 1 : 0,
    newIntegration.targetFormat
  );
  const fetchedIntegration = await getIntegrationById(newIntegration.id);
  return fetchedIntegration!;
}

export async function updateIntegration(id: string, integration: Partial<Omit<Integration, 'id'>>): Promise<Integration | null> {
 const existing = await getIntegrationById(id);
  if (!existing) return null;

  const dataToSave = { ...existing, ...integration, id };
  const encryptedWebhookUrl = await encrypt(dataToSave.webhookUrl);

  const stmt = getDB().prepare(
    'UPDATE integrations SET name = ?, platform = ?, webhookUrl = ?, enabled = ?, targetFormat = ? WHERE id = ?'
  );
  stmt.run(
    dataToSave.name,
    dataToSave.platform,
    encryptedWebhookUrl,
    dataToSave.enabled ? 1 : 0,
    dataToSave.targetFormat,
    id
  );
  const updatedData = await getIntegrationById(id); 
  return updatedData;
}

export async function deleteIntegration(id: string): Promise<boolean> {
  const stmt = getDB().prepare('DELETE FROM integrations WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// --- API Endpoints CRUD ---
export async function getApiEndpoints(): Promise<ApiEndpointConfig[]> {
  const stmt = getDB().prepare('SELECT * FROM api_endpoints ORDER BY name ASC');
  const rows = stmt.all() as ApiEndpointConfig[];
   return rows.map(ep => ({
    ...ep,
    associatedIntegrationIds: JSON.parse(ep.associatedIntegrationIds as unknown as string || '[]')
  }));
}

export async function getApiEndpointById(id: string): Promise<ApiEndpointConfig | null> {
  const stmt = getDB().prepare('SELECT * FROM api_endpoints WHERE id = ?');
  const row = stmt.get(id) as ApiEndpointConfig | null;
  return row ? { ...row, associatedIntegrationIds: JSON.parse(row.associatedIntegrationIds as unknown as string || '[]') } : null;
}

export async function getApiEndpointByPath(path: string): Promise<ApiEndpointConfig | null> {
  const stmt = getDB().prepare('SELECT * FROM api_endpoints WHERE path = ?');
  const row = stmt.get(path) as ApiEndpointConfig | null;
  return row ? { ...row, associatedIntegrationIds: JSON.parse(row.associatedIntegrationIds as unknown as string || '[]') } : null;
}

export async function addApiEndpoint(endpoint: Omit<ApiEndpointConfig, 'id' | 'createdAt'>): Promise<ApiEndpointConfig> {
  const newEndpoint: ApiEndpointConfig = {
    id: uuidv4(),
    ...endpoint,
    associatedIntegrationIds: JSON.stringify(endpoint.associatedIntegrationIds || []),
    createdAt: new Date().toISOString(),
  };
  const stmt = getDB().prepare(
    'INSERT INTO api_endpoints (id, name, path, associatedIntegrationIds, createdAt) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(
    newEndpoint.id,
    newEndpoint.name,
    newEndpoint.path,
    newEndpoint.associatedIntegrationIds, // Store as JSON string
    newEndpoint.createdAt
  );
   return {
    ...newEndpoint,
    associatedIntegrationIds: JSON.parse(newEndpoint.associatedIntegrationIds as unknown as string)
  };
}

export async function updateApiEndpoint(id: string, endpoint: Partial<Omit<ApiEndpointConfig, 'id' | 'createdAt'>>): Promise<ApiEndpointConfig | null> {
  const existing = await getApiEndpointById(id); 
  if (!existing) return null;

  const updatedEndpointData = { ...existing, ...endpoint, id };

  const stmt = getDB().prepare(
    'UPDATE api_endpoints SET name = ?, path = ?, associatedIntegrationIds = ? WHERE id = ?'
  );
  stmt.run(
    updatedEndpointData.name,
    updatedEndpointData.path,
    JSON.stringify(updatedEndpointData.associatedIntegrationIds || []), // Store as JSON string
    id
  );
  return getApiEndpointById(id); 
}

export async function deleteApiEndpoint(id: string): Promise<boolean> {
  const stmt = getDB().prepare('DELETE FROM api_endpoints WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// --- Request Logs ---
const MAX_LOG_ENTRIES = 50;

export async function getRequestLogs(): Promise<LogEntry[]> {
  const stmt = getDB().prepare('SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT ?');
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
  const newLog: LogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...log,
  };

  const encryptedHeaders = await encrypt(JSON.stringify(newLog.incomingRequest.headers || {}));
  const encryptedBodyRaw = await encrypt(newLog.incomingRequest.bodyRaw);
  const encryptedIntegrations = await encrypt(JSON.stringify(newLog.integrations || []));

  const stmt = getDB().prepare(
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

  const countStmt = getDB().prepare('SELECT COUNT(*) as count FROM request_logs');
  const { count } = countStmt.get() as { count: number };
  if (count > MAX_LOG_ENTRIES) {
    const deleteStmt = getDB().prepare(
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

// Helper for dashboard stats
export async function getDashboardStats(): Promise<{ activeIntegrationsCount: number; relayedNotificationsCount: number; }> {
    const dbInstance = getDB();
    const activeIntegrationsCountResult = dbInstance.prepare('SELECT COUNT(*) as count FROM integrations WHERE enabled = 1').get() as { count: number };
    const totalLogsCountResult = dbInstance.prepare('SELECT COUNT(*) as count FROM request_logs').get() as { count: number };
    return {
        activeIntegrationsCount: activeIntegrationsCountResult.count,
        relayedNotificationsCount: totalLogsCountResult.count,
    };
}

// --- SMTP Settings ---
export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const stmt = getDB().prepare('SELECT * FROM smtp_settings WHERE id = ?');
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
  const encryptedPassword = settings.password ? await encrypt(settings.password) : '';
  const stmt = getDB().prepare(
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
