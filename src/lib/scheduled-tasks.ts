import { cleanupOldLogs, createBackup, getSecuritySettings } from './log-manager';
import { processQueue, cleanupOldNotifications } from './notification-queue';
import { sendScheduledDigests } from './notification-digest';
import { cleanupExpiredSessions } from './session-manager';
import { cleanupOldAuditLogs } from './audit-log';
import { cleanupExpiredBlacklists } from './ip-access-control';
import { cleanupOldFailedAttempts } from './account-lockout';

let logCleanupInterval: NodeJS.Timeout | null = null;
let backupInterval: NodeJS.Timeout | null = null;
let queueProcessingInterval: NodeJS.Timeout | null = null;
let queueCleanupInterval: NodeJS.Timeout | null = null;
let digestInterval: NodeJS.Timeout | null = null;
let sessionCleanupInterval: NodeJS.Timeout | null = null;
let auditLogCleanupInterval: NodeJS.Timeout | null = null;
let ipBlacklistCleanupInterval: NodeJS.Timeout | null = null;
let failedLoginCleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initialize scheduled tasks
 */
export function initScheduledTasks() {
  // Stop any existing intervals
  stopScheduledTasks();
  
  // Schedule log cleanup task - run daily
  logCleanupInterval = setInterval(async () => {
    console.log('Running scheduled log cleanup');
    try {
      const result = await cleanupOldLogs();
      console.log(`Scheduled log cleanup completed: ${result.removed} logs removed`);
    } catch (error) {
      console.error('Scheduled log cleanup failed:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
  
  // Schedule backup task - run weekly
  backupInterval = setInterval(async () => {
    console.log('Running scheduled database backup');
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const settings = await getSecuritySettings();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const backupRetentionDays = process.env.BACKUP_RETENTION_DAYS 
        ? parseInt(process.env.BACKUP_RETENTION_DAYS) 
        : 7;
        
      // Create backup
      const result = await createBackup();
      console.log(`Scheduled backup completed: ${result.success ? 'Success' : 'Failed'}`);
      
      // TODO: Implement cleanup of old backups based on backupRetentionDays
    } catch (error) {
      console.error('Scheduled backup failed:', error);
    }
  }, 7 * 24 * 60 * 60 * 1000); // 7 days

  // Schedule queue processing - run every minute
  queueProcessingInterval = setInterval(async () => {
    console.log('Processing notification queue');
    try {
      const result = await processQueue(20); // Process up to 20 pending notifications
      console.log(`Queue processing completed: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);
    } catch (error) {
      console.error('Queue processing failed:', error);
    }
  }, 60 * 1000); // 1 minute

  // Schedule queue cleanup task - run daily
  queueCleanupInterval = setInterval(async () => {
    console.log('Running scheduled notification queue cleanup');
    try {
      const deletedCount = await cleanupOldNotifications();
      console.log(`Scheduled queue cleanup completed: ${deletedCount} old notifications removed`);
    } catch (error) {
      console.error('Scheduled queue cleanup failed:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Schedule digest email task - check every hour
  digestInterval = setInterval(async () => {
    try {
      await sendScheduledDigests();
    } catch (error) {
      console.error('Scheduled digest email task failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Schedule session cleanup task - run every hour
  sessionCleanupInterval = setInterval(async () => {
    console.log('Running scheduled session cleanup');
    try {
      const deletedCount = await cleanupExpiredSessions();
      console.log(`Scheduled session cleanup completed: ${deletedCount} expired sessions removed`);
    } catch (error) {
      console.error('Scheduled session cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Schedule audit log cleanup task - run daily
  auditLogCleanupInterval = setInterval(async () => {
    console.log('Running scheduled audit log cleanup');
    try {
      const deletedCount = await cleanupOldAuditLogs(90); // Keep 90 days by default
      console.log(`Scheduled audit log cleanup completed: ${deletedCount} old audit logs removed`);
    } catch (error) {
      console.error('Scheduled audit log cleanup failed:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Schedule IP blacklist cleanup task - run every hour
  ipBlacklistCleanupInterval = setInterval(async () => {
    console.log('Running scheduled IP blacklist cleanup');
    try {
      const result = await cleanupExpiredBlacklists();
      console.log(`Scheduled IP blacklist cleanup completed: ${result.global} global, ${result.tenant} tenant entries removed`);
    } catch (error) {
      console.error('Scheduled IP blacklist cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Schedule failed login attempts cleanup task - run daily
  failedLoginCleanupInterval = setInterval(async () => {
    console.log('Running scheduled failed login attempts cleanup');
    try {
      const deletedCount = await cleanupOldFailedAttempts();
      console.log(`Scheduled failed login cleanup completed: ${deletedCount} old failed attempts removed`);
    } catch (error) {
      console.error('Scheduled failed login cleanup failed:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduledTasks() {
  if (logCleanupInterval) {
    clearInterval(logCleanupInterval);
    logCleanupInterval = null;
  }
  
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }

  if (queueProcessingInterval) {
    clearInterval(queueProcessingInterval);
    queueProcessingInterval = null;
  }

  if (queueCleanupInterval) {
    clearInterval(queueCleanupInterval);
    queueCleanupInterval = null;
  }

  if (digestInterval) {
    clearInterval(digestInterval);
    digestInterval = null;
  }

  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
    sessionCleanupInterval = null;
  }

  if (auditLogCleanupInterval) {
    clearInterval(auditLogCleanupInterval);
    auditLogCleanupInterval = null;
  }

  if (ipBlacklistCleanupInterval) {
    clearInterval(ipBlacklistCleanupInterval);
    ipBlacklistCleanupInterval = null;
  }

  if (failedLoginCleanupInterval) {
    clearInterval(failedLoginCleanupInterval);
    failedLoginCleanupInterval = null;
  }
}
