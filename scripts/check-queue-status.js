// Simple script to check notification queue system status
import sqlite3 from 'sqlite3';

// Initialize SQLite database connection
const db = new sqlite3.verbose().Database('./app.db');

console.log('Checking notification queue system status...');

// Check if queue processing is enabled in system settings
db.get('SELECT value FROM system_settings WHERE key = "queue_processing_enabled"', (err, row) => {
  if (err) {
    console.error('Error checking queue processing setting:', err);
  } else {
    console.log(`Queue processing enabled: ${row?.value === 'true' ? 'Yes' : 'No'}`);
  }

  // Check the status distribution of queue items
  db.all('SELECT status, COUNT(*) as count FROM notification_queue GROUP BY status', (err, rows) => {
    if (err) {
      console.error('Error checking queue items:', err);
    } else {
      console.log('\nQueue item status distribution:');
      rows.forEach(row => {
        console.log(`${row.status}: ${row.count}`);
      });
    }

    // Check details of pending items
    db.all(`
      SELECT 
        id, 
        status, 
        retryCount, 
        createdAt, 
        lastAttemptAt, 
        nextRetryAt, 
        webhookUrl, 
        platform 
      FROM 
        notification_queue 
      WHERE 
        status = 'pending' 
      LIMIT 3
    `, (err, rows) => {
      if (err) {
        console.error('Error fetching pending notifications:', err);
      } else {
        console.log('\nPending notification details:');
        rows.forEach(row => {
          console.log(`\nID: ${row.id}`);
          console.log(`Platform: ${row.platform}`);
          console.log(`Webhook URL: ${row.webhookUrl}`);
          console.log(`Created: ${row.createdAt}`);
          console.log(`Last Attempt: ${row.lastAttemptAt || 'None'}`);
          console.log(`Next Retry: ${row.nextRetryAt || 'Not scheduled'}`);
          console.log(`Retry Count: ${row.retryCount}`);
        });
      }

      // Check server.js and scheduled tasks
      console.log('\nChecking if the server is set up to initialize scheduled tasks...');
      
      // Close the database connection
      db.close();
    });
  });
});
