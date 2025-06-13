#!/usr/bin/env node

// Simple direct queue processor that doesn't depend on the application's modules
import sqlite3 from 'sqlite3';
import fetch from 'node-fetch';

// Constants for retry delays (in milliseconds)
const RETRY_DELAYS = [
  60 * 1000,      // 1 minute
  5 * 60 * 1000,  // 5 minutes
  30 * 60 * 1000  // 30 minutes
];

// Open database connection
const db = new sqlite3.Database('./app.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
});

// Check if queue processing is enabled
function isQueueProcessingEnabled() {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM system_settings WHERE key = ?', ['queue_processing_enabled'], (err, row) => {
      if (err) {
        console.error('Error checking queue processing setting:', err);
        resolve(false);
        return;
      }
      const enabled = row && row.value === 'true';
      console.log(`Queue processing enabled: ${enabled ? 'Yes' : 'No'}`);
      resolve(enabled);
    });
  });
}

// Get pending notifications
function getPendingNotifications(limit = 10) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    db.all(`
      SELECT * FROM notification_queue 
      WHERE status = 'pending' 
      AND (nextRetryAt IS NULL OR nextRetryAt <= ?)
      ORDER BY priority DESC, createdAt ASC
      LIMIT ?
    `, [now, limit], (err, rows) => {
      if (err) {
        console.error('Error getting pending notifications:', err);
        reject(err);
        return;
      }
      
      console.log(`Found ${rows.length} pending notifications to process`);
      resolve(rows);
    });
  });
}

// Update notification status
function updateNotification(id, updates) {
  return new Promise((resolve, reject) => {
    // Build the update SQL dynamically
    const fields = [];
    const values = [];
    
    // Always add an updated timestamp
    updates.updatedAt = new Date().toISOString();
    
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    
    const sql = `UPDATE notification_queue SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    
    db.run(sql, values, function(err) {
      if (err) {
        console.error(`Error updating notification ${id}:`, err);
        reject(err);
        return;
      }
      
      console.log(`Updated notification ${id}: ${this.changes} row(s) affected`);
      resolve(this.changes);
    });
  });
}

// Process a notification
async function processNotification(notification) {
  console.log(`\nProcessing notification ${notification.id} for ${notification.platform}`);
  console.log(`Webhook URL: ${notification.webhookUrl}`);
  
  try {
    // Mark as processing
    await updateNotification(notification.id, {
      status: 'processing',
      lastAttemptAt: new Date().toISOString()
    });
    
    // Send notification to webhook
    console.log('Sending notification...');
    const response = await fetch(notification.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': notification.contentType || 'application/json',
        'User-Agent': 'NCRelay-Direct/1.0',
      },
      body: notification.payload
    });
    
    const responseBody = await response.text();
    console.log(`Response status: ${response.status}`);
    
    // Check if successful
    if (response.ok) {
      console.log('Notification delivered successfully');
      
      // Mark as completed
      await updateNotification(notification.id, {
        status: 'completed',
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000) // Limit size
      });
      
      return true;
    } else {
      // Handle failure and retry logic
      const shouldRetry = notification.retryCount < notification.maxRetries;
      
      if (shouldRetry) {
        const retryDelay = RETRY_DELAYS[notification.retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
        
        console.log(`Delivery failed, scheduling retry at ${new Date(Date.now() + retryDelay).toLocaleString()}`);
        
        await updateNotification(notification.id, {
          status: 'pending',
          retryCount: notification.retryCount + 1,
          nextRetryAt: nextRetryAt,
          errorDetails: `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
          responseStatus: response.status,
          responseBody: responseBody.substring(0, 1000)
        });
      } else {
        console.log('Max retries reached, marking as failed');
        
        await updateNotification(notification.id, {
          status: 'failed',
          errorDetails: `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
          responseStatus: response.status,
          responseBody: responseBody.substring(0, 1000)
        });
      }
      
      return false;
    }
  } catch (error) {
    console.error(`Error processing notification:`, error.message);
    
    // Check if we should retry
    const shouldRetry = notification.retryCount < notification.maxRetries;
    
    if (shouldRetry) {
      const retryDelay = RETRY_DELAYS[notification.retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
      
      console.log(`Error occurred, scheduling retry at ${new Date(Date.now() + retryDelay).toLocaleString()}`);
      
      await updateNotification(notification.id, {
        status: 'pending',
        retryCount: notification.retryCount + 1,
        nextRetryAt: nextRetryAt,
        errorDetails: error.message
      });
    } else {
      console.log('Max retries reached, marking as failed');
      
      await updateNotification(notification.id, {
        status: 'failed',
        errorDetails: error.message
      });
    }
    
    return false;
  }
}

// Main function
async function main() {
  console.log('Starting direct notification queue processor');
  
  try {
    // Step 1: Check if queue processing is enabled
    const enabled = await isQueueProcessingEnabled();
    if (!enabled) {
      console.log('Queue processing is disabled. Exiting.');
      db.close();
      return;
    }
    
    // Step 2: Get pending notifications
    const pendingNotifications = await getPendingNotifications(20);
    if (pendingNotifications.length === 0) {
      console.log('No pending notifications to process. Exiting.');
      db.close();
      return;
    }
    
    // Step 3: Process each notification
    let succeeded = 0;
    let failed = 0;
    
    for (const notification of pendingNotifications) {
      const success = await processNotification(notification);
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    }
    
    console.log(`\nProcessing complete. ${pendingNotifications.length} processed: ${succeeded} succeeded, ${failed} failed.`);
  } catch (error) {
    console.error('Error in queue processing:', error);
  } finally {
    // Close the database connection
    db.close();
  }
}

// Run the script
main();
