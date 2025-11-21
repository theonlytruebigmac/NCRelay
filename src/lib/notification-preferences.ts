import { getDB } from './db';
import type { NotificationPreferences, DigestFrequency } from './types';

// Notification Preferences CRUD functions

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  const db = await getDB();
  const stmt = db.prepare(`SELECT * FROM notification_preferences WHERE userId = ?`);
  const row = stmt.get(userId) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    userId: row.userId as string,
    emailNotifications: Boolean(row.emailNotifications),
    systemNotifications: Boolean(row.systemNotifications),
    importantOnly: Boolean(row.importantOnly),
    failureNotificationsOnly: Boolean(row.failureNotificationsOnly),
    emailDigestFrequency: row.emailDigestFrequency as DigestFrequency,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string
  };
}

export async function createNotificationPreferences(
  userId: string,
  prefs: Partial<Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<NotificationPreferences> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  const newPrefs = {
    userId,
    emailNotifications: prefs.emailNotifications ?? true,
    systemNotifications: prefs.systemNotifications ?? true,
    importantOnly: prefs.importantOnly ?? false,
    failureNotificationsOnly: prefs.failureNotificationsOnly ?? true,
    emailDigestFrequency: prefs.emailDigestFrequency ?? 'never',
    createdAt: now,
    updatedAt: now
  };
  
  const stmt = db.prepare(`
    INSERT INTO notification_preferences (
      userId, emailNotifications, systemNotifications, importantOnly, 
      failureNotificationsOnly, emailDigestFrequency, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  
  stmt.run(
    newPrefs.userId,
    newPrefs.emailNotifications ? 1 : 0,
    newPrefs.systemNotifications ? 1 : 0,
    newPrefs.importantOnly ? 1 : 0,
    newPrefs.failureNotificationsOnly ? 1 : 0,
    newPrefs.emailDigestFrequency,
    newPrefs.createdAt,
    newPrefs.updatedAt
  );
  
  return newPrefs;
}

export async function ensureNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const existing = await getNotificationPreferences(userId);
  
  if (existing) {
    return existing;
  }
  
  // Create default preferences
  return createNotificationPreferences(userId, {});
}

export async function updateNotificationPreferences(
  userId: string, 
  prefs: Partial<Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<NotificationPreferences | null> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  const existingPrefs = await getNotificationPreferences(userId);
  if (!existingPrefs) return null;
  
  const updateFields: string[] = ['updatedAt = ?'];
  const params: Array<boolean | string | number> = [now];
  
  if (prefs.emailNotifications !== undefined) {
    updateFields.push('emailNotifications = ?');
    params.push(prefs.emailNotifications ? 1 : 0);
  }
  
  if (prefs.systemNotifications !== undefined) {
    updateFields.push('systemNotifications = ?');
    params.push(prefs.systemNotifications ? 1 : 0);
  }
  
  if (prefs.importantOnly !== undefined) {
    updateFields.push('importantOnly = ?');
    params.push(prefs.importantOnly ? 1 : 0);
  }
  
  if (prefs.failureNotificationsOnly !== undefined) {
    updateFields.push('failureNotificationsOnly = ?');
    params.push(prefs.failureNotificationsOnly ? 1 : 0);
  }
  
  if (prefs.emailDigestFrequency !== undefined) {
    updateFields.push('emailDigestFrequency = ?');
    params.push(prefs.emailDigestFrequency);
  }
  
  // Add userId to params
  params.push(userId);
  
  const stmt = db.prepare(
    `UPDATE notification_preferences SET ${updateFields.join(', ')} WHERE userId = ?`
  );
  
  stmt.run(...params);
  
  return getNotificationPreferences(userId);
}
