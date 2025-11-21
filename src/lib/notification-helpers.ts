'use server';

import { getNotificationPreferences } from './notification-preferences';
import type { QueuedNotification } from './types';

/**
 * Check if a notification should be sent based on user preferences
 */
export async function shouldSendNotification(
  userId: string,
  notification: QueuedNotification
): Promise<{ shouldSend: boolean; reason?: string }> {
  // Get user preferences
  const prefs = await getNotificationPreferences(userId);
  
  // If no preferences exist, use defaults (send all notifications)
  if (!prefs) {
    return { shouldSend: true, reason: 'No preferences set, using defaults' };
  }
  
  // Check if all notifications are disabled
  if (!prefs.emailNotifications && !prefs.systemNotifications) {
    return { shouldSend: false, reason: 'All notifications disabled' };
  }
  
  // Check if only failure notifications should be sent
  if (prefs.failureNotificationsOnly) {
    // Consider a notification as failure if it has retry count > 0 or status is 'failed'
    const isFailure = notification.status === 'failed' || notification.retryCount > 0;
    if (!isFailure) {
      return { shouldSend: false, reason: 'Only failure notifications enabled' };
    }
  }
  
  // Check if only important notifications should be sent
  if (prefs.importantOnly) {
    // For now, we'll consider failed notifications as important
    // You can extend this logic based on your needs
    const isImportant = notification.status === 'failed' || notification.priority > 0;
    if (!isImportant) {
      return { shouldSend: false, reason: 'Only important notifications enabled' };
    }
  }
  
  return { shouldSend: true };
}

/**
 * Check if email notifications should be sent for a user
 */
export async function shouldSendEmailNotification(userId: string): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);
  
  // Default to true if no preferences
  if (!prefs) return true;
  
  return prefs.emailNotifications;
}

/**
 * Check if system notifications should be sent for a user
 */
export async function shouldSendSystemNotification(userId: string): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);
  
  // Default to true if no preferences
  if (!prefs) return true;
  
  return prefs.systemNotifications;
}

/**
 * Get users who should receive email digests
 */
export async function getUsersForEmailDigest(frequency: 'daily' | 'weekly' | 'monthly'): Promise<string[]> {
  const { getDB } = await import('./db');
  const db = await getDB();
  
  const stmt = db.prepare(`
    SELECT userId FROM notification_preferences 
    WHERE emailDigestFrequency = ? AND emailNotifications = 1
  `);
  
  const rows = stmt.all(frequency) as Array<{ userId: string }>;
  return rows.map(row => row.userId);
}
