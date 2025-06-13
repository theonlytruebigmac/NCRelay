// Manual script to process the notification queue
import { processQueue } from '../src/lib/notification-queue.js';
import '../src/server.js'; // Import server initialization

// Set environment variable to force initialization
process.env.FORCE_INIT = 'true';

async function main() {
  console.log('Manually processing notification queue...');
  
  try {
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = await processQueue(20);
    console.log('Queue processing result:', result);
  } catch (error) {
    console.error('Error processing queue:', error);
  }
  
  // Exit after processing
  process.exit(0);
}

main();
