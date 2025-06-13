'use server';

import { getDB } from './db';

/**
 * System settings service for managing application settings
 */

/**
 * Get a system setting by key
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  const db = await getDB();
  const result = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
  
  if (!result) {
    return null;
  }
  
  return result.value;
}

/**
 * Get the queue processing enabled state
 */
export async function isQueueProcessingEnabled(): Promise<boolean> {
  const value = await getSystemSetting('queue_processing_enabled');
  return value === 'true';
}

/**
 * Set a system setting
 */
export async function setSystemSetting(key: string, value: string, description?: string): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  // Check if setting exists
  const existing = await getSystemSetting(key);
  
  if (existing !== null) {
    // Update existing setting
    db.prepare(`
      UPDATE system_settings 
      SET value = ?, updatedAt = ?, description = COALESCE(?, description)
      WHERE key = ?
    `).run(value, now, description, key);
  } else {
    // Insert new setting
    db.prepare(`
      INSERT INTO system_settings (id, key, value, description, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(key, key, value, description || null, now);
  }
}

/**
 * Set the queue processing enabled state
 */
export async function setQueueProcessingEnabled(enabled: boolean): Promise<void> {
  await setSystemSetting(
    'queue_processing_enabled', 
    enabled ? 'true' : 'false',
    'Controls whether the notification queue processing is active'
  );
}
