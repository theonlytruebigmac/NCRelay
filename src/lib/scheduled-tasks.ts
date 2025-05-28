import { cleanupOldLogs, createBackup, getSecuritySettings } from './log-manager';

let logCleanupInterval: NodeJS.Timeout | null = null;
let backupInterval: NodeJS.Timeout | null = null;

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
      const settings = await getSecuritySettings();
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
}
