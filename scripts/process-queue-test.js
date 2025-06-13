
// Test script to process pending queue items manually
import sqlite3 from 'sqlite3';
import fetch from 'node-fetch';

const sqliteVerbose = sqlite3.verbose();
const db = new sqliteVerbose.Database('./app.db');

console.log('Starting manual queue processing...');

// Get pending notifications
db.all(
  `SELECT * FROM notification_queue 
   WHERE status = 'pending' 
   AND (nextRetryAt IS NULL OR nextRetryAt <= datetime('now')) 
   ORDER BY priority DESC, createdAt ASC 
   LIMIT 5`,
  [],
  async (err, rows) => {
    if (err) {
      console.error('Error fetching pending notifications:', err);
      process.exit(1);
    }

    console.log(`Found ${rows.length} pending notifications to process`);
    
    if (rows.length === 0) {
      process.exit(0);
    }
    
    // Process each notification
    for (const notification of rows) {
      console.log(`Processing notification ID: ${notification.id}`);
      console.log(`  Platform: ${notification.platform}`);
      console.log(`  Webhook URL: ${notification.webhookUrl}`);
      
      // Update status to processing
      db.run(
        `UPDATE notification_queue SET status = 'processing', lastAttemptAt = datetime('now') WHERE id = ?`,
        [notification.id],
        async (err) => {
          if (err) {
            console.error(`Error updating notification ${notification.id} to processing:`, err);
            return;
          }
          
          try {
            console.log(`Sending notification to ${notification.webhookUrl}`);
            
            // Try to send the notification
            const response = await fetch(notification.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': notification.contentType || 'application/json',
                'User-Agent': 'NCRelay/1.0',
              },
              body: notification.payload
            });
            
            const responseBody = await response.text();
            console.log(`Response status: ${response.status}`);
            console.log(`Response body: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`);
            
            if (response.ok) {
              // Success - mark as completed
              db.run(
                `UPDATE notification_queue SET 
                status = 'completed', 
                responseStatus = ?, 
                responseBody = ?,
                updatedAt = datetime('now')
                WHERE id = ?`,
                [response.status, responseBody, notification.id],
                (err) => {
                  if (err) {
                    console.error(`Error updating notification ${notification.id} to completed:`, err);
                  } else {
                    console.log(`Notification ${notification.id} marked as completed`);
                  }
                }
              );
            } else {
              // Failed - calculate retry or mark as failed
              const shouldRetry = notification.retryCount < notification.maxRetries;
              
              if (shouldRetry) {
                const retryDelays = [
                  60 * 1000,       // 1 minute
                  5 * 60 * 1000,   // 5 minutes 
                  30 * 60 * 1000   // 30 minutes
                ];
                const retryDelay = retryDelays[notification.retryCount] || retryDelays[retryDelays.length - 1];
                const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
                
                db.run(
                  `UPDATE notification_queue SET 
                  status = 'pending', 
                  retryCount = retryCount + 1, 
                  nextRetryAt = ?,
                  errorDetails = ?,
                  responseStatus = ?,
                  responseBody = ?,
                  updatedAt = datetime('now')
                  WHERE id = ?`,
                  [nextRetryAt, `HTTP ${response.status}: ${responseBody}`, response.status, responseBody, notification.id],
                  (err) => {
                    if (err) {
                      console.error(`Error updating notification ${notification.id} for retry:`, err);
                    } else {
                      console.log(`Notification ${notification.id} scheduled for retry at ${nextRetryAt}`);
                    }
                  }
                );
              } else {
                // Max retries reached - mark as failed
                db.run(
                  `UPDATE notification_queue SET 
                  status = 'failed', 
                  errorDetails = ?,
                  responseStatus = ?,
                  responseBody = ?,
                  updatedAt = datetime('now')
                  WHERE id = ?`,
                  [`HTTP ${response.status}: ${responseBody}`, response.status, responseBody, notification.id],
                  (err) => {
                    if (err) {
                      console.error(`Error updating notification ${notification.id} to failed:`, err);
                    } else {
                      console.log(`Notification ${notification.id} marked as failed (max retries reached)`);
                    }
                  }
                );
              }
            }
          } catch (error) {
            console.error(`Error processing notification ${notification.id}:`, error);
            
            // Mark as retryable error or failed
            const shouldRetry = notification.retryCount < notification.maxRetries;
            
            if (shouldRetry) {
              const retryDelays = [
                60 * 1000,       // 1 minute
                5 * 60 * 1000,   // 5 minutes 
                30 * 60 * 1000   // 30 minutes
              ];
              const retryDelay = retryDelays[notification.retryCount] || retryDelays[retryDelays.length - 1];
              const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
              
              db.run(
                `UPDATE notification_queue SET 
                status = 'pending', 
                retryCount = retryCount + 1, 
                nextRetryAt = ?,
                errorDetails = ?,
                updatedAt = datetime('now')
                WHERE id = ?`,
                [nextRetryAt, error.message || 'Unknown error', notification.id],
                (err) => {
                  if (err) {
                    console.error(`Error updating notification ${notification.id} for retry:`, err);
                  } else {
                    console.log(`Notification ${notification.id} scheduled for retry at ${nextRetryAt} due to error`);
                  }
                }
              );
            } else {
              // Max retries reached - mark as failed
              db.run(
                `UPDATE notification_queue SET 
                status = 'failed', 
                errorDetails = ?,
                updatedAt = datetime('now')
                WHERE id = ?`,
                [error.message || 'Unknown error', notification.id],
                (err) => {
                  if (err) {
                    console.error(`Error updating notification ${notification.id} to failed:`, err);
                  } else {
                    console.log(`Notification ${notification.id} marked as failed (max retries reached)`);
                  }
                }
              );
            }
          }
        }
      );
    }
  }
);

// Close the database connection after a delay to allow processing to complete
setTimeout(() => {
  console.log('Closing database connection');
  db.close();
  process.exit(0);
}, 10000); // 10 seconds delay
