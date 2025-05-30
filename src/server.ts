import { initScheduledTasks } from './lib/scheduled-tasks';

// This file will be imported on server startup only
import { initializeDatabase } from './lib/db';

// Initialize app
async function initializeApp() {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Then start scheduled tasks
    initScheduledTasks();
    
    console.log('NCRelay server initialized successfully');
  } catch (error) {
    console.error('Failed to initialize NCRelay server:', error);
  }
}

// Run initialization
initializeApp();
