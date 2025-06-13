import path from 'path';
import fs from 'fs/promises';
import Database from 'better-sqlite3';
import { SecuritySettings } from './types';

// DB Configuration
const DB_PATH = process.env.NODE_ENV === 'production' ? '/data/app.db' : path.join(process.cwd(), 'app.db');

// Database instance
let db: Database.Database | null = null;

// Get a database connection
function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
  }
  return db;
}

/**
 * Helper to get the current security settings
 */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    const dbInstance = getDB();
    const settings = dbInstance.prepare(`
      SELECT * FROM security_settings WHERE id = ?
    `).get('default_security_settings') as Record<string, unknown> | undefined;
    
    if (!settings) {
      // Default settings if not in DB yet
      return {
        id: 'default_security_settings',
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        maxPayloadSize: parseInt(process.env.MAX_PAYLOAD_SIZE || '10485760'),
        logRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
        apiRateLimitEnabled: true,
        webhookRateLimitEnabled: false,
        ipWhitelist: [],
        enableDetailedErrorLogs: false
      };
    }
    
    return {
      id: settings.id as string,
      rateLimitMaxRequests: settings.rateLimitMaxRequests as number,
      rateLimitWindowMs: settings.rateLimitWindowMs as number,
      maxPayloadSize: settings.maxPayloadSize as number,
      logRetentionDays: settings.logRetentionDays as number,
      apiRateLimitEnabled: !!settings.apiRateLimitEnabled,
      webhookRateLimitEnabled: !!settings.webhookRateLimitEnabled,
      ipWhitelist: JSON.parse(settings.ipWhitelist as string || '[]'),
      enableDetailedErrorLogs: !!settings.enableDetailedErrorLogs
    };
  } catch (error) {
    console.error('Error loading security settings:', error);
    // Fallback to default settings from env vars
    return {
      id: 'default_security_settings',
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      maxPayloadSize: parseInt(process.env.MAX_PAYLOAD_SIZE || '10485760'),
      logRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
      apiRateLimitEnabled: true,
      webhookRateLimitEnabled: false,
      ipWhitelist: [],
      enableDetailedErrorLogs: false
    };
  }
}

/**
 * Clean up logs older than the retention period
 */
export async function cleanupOldLogs(): Promise<{ removed: number, error?: string }> {
  try {
    const settings = await getSecuritySettings();
    const retentionDays = settings.logRetentionDays;
    const dbInstance = getDB();
    
    // Calculate the cutoff date
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (retentionDays * 24 * 60 * 60 * 1000));
    const cutoffTimestamp = cutoffDate.toISOString();
    
    // Delete logs older than the cutoff date
    const result = dbInstance.prepare(`
      DELETE FROM logs 
      WHERE timestamp < ?
    `).run(cutoffTimestamp);
    
    console.log(`Cleaned up ${result.changes} logs older than ${retentionDays} days`);
    
    return { removed: result.changes };
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    return { 
      removed: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get the current log size statistics
 */
export async function getLogStats(): Promise<{ count: number, oldestLog: string, newestLog: string }> {
  try {
    const dbInstance = getDB();
    const countResult = dbInstance.prepare('SELECT COUNT(*) as count FROM logs').get() as { count: number };
    const oldestResult = dbInstance.prepare('SELECT timestamp FROM logs ORDER BY timestamp ASC LIMIT 1').get() as { timestamp: string } | undefined;
    const newestResult = dbInstance.prepare('SELECT timestamp FROM logs ORDER BY timestamp DESC LIMIT 1').get() as { timestamp: string } | undefined;
    
    return {
      count: countResult.count,
      oldestLog: oldestResult?.timestamp || 'No logs',
      newestLog: newestResult?.timestamp || 'No logs'
    };
  } catch (error) {
    console.error('Error getting log stats:', error);
    return {
      count: 0,
      oldestLog: 'Error',
      newestLog: 'Error'
    };
  }
}

/**
 * Create a database backup
 */
export async function createBackup(): Promise<{ success: boolean, path?: string, error?: string }> {
  try {
    const dbInstance = getDB();
    // Path to DB file - only used for logging, actual backup is done via SQLite backup API
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const backupDbPath = process.env.NODE_ENV === 'production' ? '/data/app.db' : path.join(process.cwd(), 'app.db');
    const backupDir = process.env.NODE_ENV === 'production' ? '/data/backups' : path.join(process.cwd(), 'backups');
    
    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true });
    
    // Generate backup filename with date
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${dateStr}.db`);
    
    // Create backup - using the database backup API
    dbInstance.backup(backupPath)
      .then(() => {
        console.log(`Backup created at ${backupPath}`);
      })
      .catch((err: Error) => {
        console.error('Backup failed:', err);
      });
    
    return { success: true, path: backupPath };
  } catch (error) {
    console.error('Error creating backup:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
