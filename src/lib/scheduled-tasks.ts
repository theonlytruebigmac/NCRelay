import { cleanupOldLogs, createBackup, getSecuritySettings } from './log-manager';
import { processQueue, cleanupOldNotifications } from './notification-queue';

let logCleanupInterval: NodeJS.Timeout | null = null;
let backupInterval: NodeJS.Timeout | null = null;
let queueProcessingInterval: NodeJS.Timeout | null = null;
let queueCleanupInterval: NodeJS.Timeout | null = null;

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
}
