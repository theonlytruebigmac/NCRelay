'use server';

import { getUsersForEmailDigest } from './notification-helpers';
import { sendNotificationDigestEmail } from './email';
import { getDB } from './db';
import type { DigestFrequency } from './types';

/**
 * Generate digest statistics for a user
 */
async function generateDigestStats(userId: string, periodDays: number): Promise<{
  totalNotifications: number;
  successfulNotifications: number;
  failedNotifications: number;
  topIntegrations: Array<{ name: string; count: number }>;
}> {
  const db = await getDB();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  const cutoffDateStr = cutoffDate.toISOString();
  
  // Get notifications for this user's integrations
  const totalResult = db.prepare(`
    SELECT COUNT(*) as count 
    FROM notification_queue nq
    INNER JOIN integrations i ON nq.integrationId = i.id
    WHERE i.userId = ? AND nq.createdAt >= ?
  `).get(userId, cutoffDateStr) as { count: number };
  
  const successResult = db.prepare(`
    SELECT COUNT(*) as count 
    FROM notification_queue nq
    INNER JOIN integrations i ON nq.integrationId = i.id
    WHERE i.userId = ? AND nq.createdAt >= ? AND nq.status = 'completed'
  `).get(userId, cutoffDateStr) as { count: number };
  
  const failedResult = db.prepare(`
    SELECT COUNT(*) as count 
    FROM notification_queue nq
    INNER JOIN integrations i ON nq.integrationId = i.id
    WHERE i.userId = ? AND nq.createdAt >= ? AND nq.status = 'failed'
  `).get(userId, cutoffDateStr) as { count: number };
  
  const topIntegrations = db.prepare(`
    SELECT nq.integrationName as name, COUNT(*) as count
    FROM notification_queue nq
    INNER JOIN integrations i ON nq.integrationId = i.id
    WHERE i.userId = ? AND nq.createdAt >= ?
    GROUP BY nq.integrationId, nq.integrationName
    ORDER BY count DESC
    LIMIT 5
  `).all(userId, cutoffDateStr) as Array<{ name: string; count: number }>;
  
  return {
    totalNotifications: totalResult.count,
    successfulNotifications: successResult.count,
    failedNotifications: failedResult.count,
    topIntegrations
  };
}

/**
 * Send digest emails for a specific frequency
 */
export async function sendDigestEmails(frequency: DigestFrequency): Promise<{ sent: number; failed: number }> {
  if (frequency === 'never') {
    return { sent: 0, failed: 0 };
  }
  
  // Determine period in days
  const periodDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
  const periodLabel = frequency === 'daily' ? 'Daily' : frequency === 'weekly' ? 'Weekly' : 'Monthly';
  
  // Get users who want this frequency
  const userIds = await getUsersForEmailDigest(frequency);
  console.log(`Found ${userIds.length} users for ${frequency} digest`);
  
  let sent = 0;
  let failed = 0;
  
  for (const userId of userIds) {
    try {
      // Get user email
      const { getUserById } = await import('./db');
      const user = await getUserById(userId);
      
      if (!user) {
        console.log(`Could not find user ${userId}, skipping digest`);
        failed++;
        continue;
      }
      
      // Generate statistics
      const stats = await generateDigestStats(userId, periodDays);
      
      // Skip if no notifications in period
      if (stats.totalNotifications === 0) {
        console.log(`No notifications for user ${user.email} in ${frequency} period, skipping digest`);
        continue;
      }
      
      // Send the digest
      await sendNotificationDigestEmail(user.email, periodLabel, stats);
      sent++;
      console.log(`Sent ${frequency} digest to ${user.email}`);
    } catch (error) {
      console.error(`Failed to send digest to user ${userId}:`, error);
      failed++;
    }
  }
  
  return { sent, failed };
}

/**
 * Send all scheduled digest emails
 */
export async function sendScheduledDigests(): Promise<void> {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayOfMonth = now.getDate();
  
  // Send daily digests at 8 AM
  if (hour === 8) {
    console.log('Sending daily digest emails...');
    const result = await sendDigestEmails('daily');
    console.log(`Daily digests: ${result.sent} sent, ${result.failed} failed`);
  }
  
  // Send weekly digests on Monday at 8 AM
  if (dayOfWeek === 1 && hour === 8) {
    console.log('Sending weekly digest emails...');
    const result = await sendDigestEmails('weekly');
    console.log(`Weekly digests: ${result.sent} sent, ${result.failed} failed`);
  }
  
  // Send monthly digests on the 1st at 8 AM
  if (dayOfMonth === 1 && hour === 8) {
    console.log('Sending monthly digest emails...');
    const result = await sendDigestEmails('monthly');
    console.log(`Monthly digests: ${result.sent} sent, ${result.failed} failed`);
  }
}
