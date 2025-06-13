// Debug script for the notification queue
import { getQueuedNotificationsByStatus } from '../src/lib/notification-queue.js';
import { initializeDatabase } from '../src/lib/db.js';
import { isQueueProcessingEnabled } from '../src/lib/system-settings.js';

async function main() {
  console.log('Debugging notification queue processing...');
  
  try {
    // Step 1: Initialize the database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized');
    
    // Step 2: Check if queue processing is enabled
    console.log('Checking if queue processing is enabled...');
    const enabled = await isQueueProcessingEnabled();
    console.log('Queue processing enabled:', enabled);
    
    // Step 3: Get pending notifications
    console.log('Fetching pending notifications...');
    const pendingNotifications = await getQueuedNotificationsByStatus('pending', 5);
    console.log(`Found ${pendingNotifications.length} pending notifications`);
    
    if (pendingNotifications.length > 0) {
      // Print details of the first notification
      console.log('First pending notification:', JSON.stringify({
        id: pendingNotifications[0].id,
        webhookUrl: pendingNotifications[0].webhookUrl,
        platform: pendingNotifications[0].platform,
        status: pendingNotifications[0].status,
        createdAt: pendingNotifications[0].createdAt
      }, null, 2));
    }
  } catch (error) {
    console.error('Error during debugging:', error);
  }
  
  // Exit after debugging
  process.exit(0);
}

main();
