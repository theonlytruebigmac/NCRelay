'use server';

import { QueuedNotification, QueueStatus } from './types';
import { getDB } from './db';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAYS = [
  60 * 1000,       // 1 minute
  5 * 60 * 1000,   // 5 minutes 
  30 * 60 * 1000   // 30 minutes
];

/**
 * Add a notification to the queue
 */
export async function enqueueNotification({
  integrationId,
  integrationName,
  platform,
  webhookUrl,
  payload,
  contentType,
  apiEndpointId,
  apiEndpointName,
  apiEndpointPath,
  originalRequestId,
  priority = 0,
  maxRetries = DEFAULT_MAX_RETRIES
}: Omit<QueuedNotification, 'id' | 'status' | 'retryCount' | 'nextRetryAt' | 'createdAt' | 'updatedAt' | 'lastAttemptAt' | 'errorDetails' | 'responseStatus' | 'responseBody'>): Promise<QueuedNotification> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  const newQueueItem: QueuedNotification = {
    id: uuidv4(),
    status: 'pending',
    priority,
    maxRetries,
    retryCount: 0,
    nextRetryAt: null,
    createdAt: now,
    updatedAt: now,
    lastAttemptAt: null,
    integrationId,
    integrationName,
    platform,
    webhookUrl,
    payload,
    contentType,
    apiEndpointId,
    apiEndpointName,
    apiEndpointPath,
    originalRequestId
  };
  
  const stmt = db.prepare(`
    INSERT INTO notification_queue (
      id, status, priority, maxRetries, retryCount, createdAt, updatedAt,
      integrationId, integrationName, platform, webhookUrl, payload, contentType,
      apiEndpointId, apiEndpointName, apiEndpointPath, originalRequestId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    newQueueItem.id,
    newQueueItem.status,
    newQueueItem.priority,
    newQueueItem.maxRetries,
    newQueueItem.retryCount,
    newQueueItem.createdAt,
    newQueueItem.updatedAt,
    newQueueItem.integrationId,
    newQueueItem.integrationName,
    newQueueItem.platform,
    newQueueItem.webhookUrl,
    newQueueItem.payload,
    newQueueItem.contentType,
    newQueueItem.apiEndpointId,
    newQueueItem.apiEndpointName,
    newQueueItem.apiEndpointPath,
    newQueueItem.originalRequestId
  );
  
  return newQueueItem;
}

/**
 * Update a notification in the queue
 */
export async function updateQueuedNotification(id: string, updates: Partial<QueuedNotification>): Promise<QueuedNotification | null> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  // Build update query dynamically based on provided fields
  const updateFields: string[] = ['updatedAt = ?'];
  const params: any[] = [now];
  
  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
      updateFields.push(`${key} = ?`);
      params.push(value);
    }
  }
  
  // Add the ID for the WHERE clause
  params.push(id);
  
  const stmt = db.prepare(`
    UPDATE notification_queue 
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `);
  
  stmt.run(...params);
  
  return getQueuedNotification(id);
}

/**
 * Get a notification from the queue by ID
 */
export async function getQueuedNotification(id: string): Promise<QueuedNotification | null> {
  const db = await getDB();
  
  const stmt = db.prepare('SELECT * FROM notification_queue WHERE id = ?');
  const row = stmt.get(id) as QueuedNotification | undefined;
  
  return row || null;
}

/**
 * Get notifications from the queue by status
 */
export async function getQueuedNotificationsByStatus(status: QueueStatus, limit = 100): Promise<QueuedNotification[]> {
  const db = await getDB();
  
  let query = 'SELECT * FROM notification_queue WHERE status = ?';
  const params: any[] = [status];
  
  // If status is pending, also check if it's ready for retry
  if (status === 'pending') {
    query += ' AND (nextRetryAt IS NULL OR nextRetryAt <= ?)';
    params.push(new Date().toISOString());
  }
  
  // Order by priority (higher first) and creation time
  query += ' ORDER BY priority DESC, createdAt ASC LIMIT ?';
  params.push(limit);
  
  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as QueuedNotification[];
  
  return rows;
}

/**
 * Process pending notifications in the queue
 */
export async function processQueue(batchSize = 10): Promise<{ processed: number, succeeded: number, failed: number }> {
  // Import here to avoid circular dependencies
  const { isQueueProcessingEnabled } = await import('./system-settings');
  
  // Check if queue processing is enabled
  const enabled = await isQueueProcessingEnabled();
  if (!enabled) {
    console.log('Queue processing is paused. Skipping processing.');
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  
  console.log(`Queue processing enabled, checking for pending notifications (max: ${batchSize})...`);
  const pendingNotifications = await getQueuedNotificationsByStatus('pending', batchSize);
  console.log(`Found ${pendingNotifications.length} pending notifications to process`);
  
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  for (const notification of pendingNotifications) {
    // Mark as processing
    await updateQueuedNotification(notification.id, { 
      status: 'processing', 
      lastAttemptAt: new Date().toISOString() 
    });
    
    processed++;
    
    try {
      // Send the notification
      const response = await fetch(notification.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': notification.contentType,
          'User-Agent': 'NCRelay/1.0',
        },
        body: notification.payload
      });
      
      const responseBody = await response.text();
      
      if (response.ok) {
        // Success - mark as completed
        await updateQueuedNotification(notification.id, {
          status: 'completed',
          responseStatus: response.status,
          responseBody
        });
        succeeded++;
      } else {
        // Failure - calculate next retry or mark as failed
        const shouldRetry = notification.retryCount < notification.maxRetries;
        
        if (shouldRetry) {
          const retryDelay = DEFAULT_RETRY_DELAYS[notification.retryCount] || DEFAULT_RETRY_DELAYS[DEFAULT_RETRY_DELAYS.length - 1];
          const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
          
          await updateQueuedNotification(notification.id, {
            status: 'pending',
            retryCount: notification.retryCount + 1,
            nextRetryAt,
            errorDetails: `HTTP ${response.status}: ${responseBody}`,
            responseStatus: response.status,
            responseBody
          });
        } else {
          // Max retries reached - mark as failed
          await updateQueuedNotification(notification.id, {
            status: 'failed',
            errorDetails: `HTTP ${response.status}: ${responseBody}`,
            responseStatus: response.status,
            responseBody
          });
          failed++;
        }
      }
    } catch (error) {
      // Error occurred during processing
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if we should retry
      const shouldRetry = notification.retryCount < notification.maxRetries;
      
      if (shouldRetry) {
        const retryDelay = DEFAULT_RETRY_DELAYS[notification.retryCount] || DEFAULT_RETRY_DELAYS[DEFAULT_RETRY_DELAYS.length - 1];
        const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
        
        await updateQueuedNotification(notification.id, {
          status: 'pending',
          retryCount: notification.retryCount + 1,
          nextRetryAt,
          errorDetails: errorMessage
        });
      } else {
        // Max retries reached - mark as failed
        await updateQueuedNotification(notification.id, {
          status: 'failed',
          errorDetails: errorMessage
        });
        failed++;
      }
    }
  }
  
  return { processed, succeeded, failed };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const db = await getDB();
  
  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0
  };
  
  // Get count for each status
  for (const status of ['pending', 'processing', 'completed', 'failed']) {
    const { count } = db.prepare(`
      SELECT COUNT(*) as count FROM notification_queue WHERE status = ?
    `).get(status) as { count: number };
    
    result[status as keyof typeof result] = count;
  }
  
  // Get total count
  const { count } = db.prepare(`
    SELECT COUNT(*) as count FROM notification_queue
  `).get() as { count: number };
  
  result.total = count;
  
  return result;
}

/**
 * Retry a failed notification
 */
export async function retryFailedNotification(id: string): Promise<QueuedNotification | null> {
  const notification = await getQueuedNotification(id);
  
  if (!notification || notification.status !== 'failed') {
    return null;
  }
  
  // Reset retry count and set status to pending
  return updateQueuedNotification(id, {
    status: 'pending',
    retryCount: 0,
    nextRetryAt: null,
    errorDetails: `Manually retried after error: ${notification.errorDetails}`
  });
}

/**
 * Get notifications for a specific request
 */
export async function getNotificationsForRequest(requestId: string): Promise<QueuedNotification[]> {
  const db = await getDB();
  
  const stmt = db.prepare(`
    SELECT * FROM notification_queue 
    WHERE originalRequestId = ?
    ORDER BY createdAt DESC
  `);
  
  return stmt.all(requestId) as QueuedNotification[];
}

/**
 * Clean up old completed notifications 
 */
export async function cleanupOldNotifications(maxAgeDays = 30): Promise<number> {
  const db = await getDB();
  
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
  const cutoffDateStr = cutoffDate.toISOString();
  
  // Delete old completed notifications
  const result = db.prepare(`
    DELETE FROM notification_queue 
    WHERE status = 'completed' 
    AND updatedAt < ?
  `).run(cutoffDateStr);
  
  return result.changes;
}
