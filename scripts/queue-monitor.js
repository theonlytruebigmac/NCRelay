// Script to check if scheduled tasks are running properly
import sqlite3 from 'sqlite3';
import fs from 'fs';

// Connect to the database
const db = new sqlite3.Database('./app.db');

// Function to log with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Also write to a log file
  fs.appendFileSync('./queue-monitor.log', logMessage + '\n');
}

// Check queue processing enabled
function checkQueueSettings() {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM system_settings WHERE key = "queue_processing_enabled"', (err, row) => {
      if (err) {
        log(`Error checking queue settings: ${err.message}`);
        reject(err);
        return;
      }
      
      const enabled = row?.value === 'true';
      log(`Queue processing enabled in settings: ${enabled ? 'YES' : 'NO'}`);
      resolve(enabled);
    });
  });
}

// Count queue items
function checkQueueCounts() {
  return new Promise((resolve, reject) => {
    db.all('SELECT status, COUNT(*) as count FROM notification_queue GROUP BY status', (err, rows) => {
      if (err) {
        log(`Error checking queue counts: ${err.message}`);
        reject(err);
        return;
      }
      
      let counts = {};
      rows.forEach(row => {
        counts[row.status] = row.count;
      });
      
      // Add missing statuses with zero count
      ['pending', 'processing', 'completed', 'failed'].forEach(status => {
        if (!counts[status]) counts[status] = 0;
      });
      
      log(`Queue status: Pending: ${counts.pending}, Processing: ${counts.processing}, Completed: ${counts.completed}, Failed: ${counts.failed}`);
      resolve(counts);
    });
  });
}

// Check pending notifications
function checkPendingItems() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        id, 
        platform,
        createdAt,
        retryCount,
        nextRetryAt
      FROM 
        notification_queue 
      WHERE 
        status = 'pending'
      LIMIT 3
    `, (err, rows) => {
      if (err) {
        log(`Error checking pending items: ${err.message}`);
        reject(err);
        return;
      }
      
      if (rows.length > 0) {
        log(`First pending item details:`);
        rows.forEach((row, i) => {
          log(`Item ${i+1} - ID: ${row.id.substring(0, 8)}... Platform: ${row.platform}, Created: ${row.createdAt}, Retries: ${row.retryCount}, Next retry: ${row.nextRetryAt || 'ASAP'}`);
        });
      } else {
        log('No pending items found');
      }
      
      resolve(rows);
    });
  });
}

// Check processing status
function checkProcessingItems() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        id, 
        platform,
        createdAt,
        lastAttemptAt
      FROM 
        notification_queue 
      WHERE 
        status = 'processing'
    `, (err, rows) => {
      if (err) {
        log(`Error checking processing items: ${err.message}`);
        reject(err);
        return;
      }
      
      if (rows.length > 0) {
        log(`Processing items (may be stuck): ${rows.length}`);
        rows.forEach(row => {
          const processingTime = row.lastAttemptAt 
            ? Math.round((new Date() - new Date(row.lastAttemptAt)) / 1000) 
            : 'unknown';
          log(`${row.id.substring(0, 8)}... (${row.platform}): processing for ${processingTime} seconds`);
        });
      }
      
      resolve(rows);
    });
  });
}

// The main monitoring function
async function monitorQueue() {
  log('Starting queue monitoring');
  
  try {
    await checkQueueSettings();
    await checkQueueCounts();
    await checkPendingItems();
    await checkProcessingItems();
  } catch (error) {
    log(`Error during monitoring: ${error}`);
  }
  
  log('Queue monitoring complete\n' + '-'.repeat(50));
  db.close();
}

// Run the monitoring
monitorQueue();
