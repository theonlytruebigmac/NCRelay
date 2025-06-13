import { initScheduledTasks } from './lib/scheduled-tasks';
import { initializeDatabase } from './lib/db';

// This file will be imported on server startup only
let isInitialized = false;

// Initialize app
export async function initializeApp() {
  // Prevent multiple initializations
  if (isInitialized) {
    return;
  }

  try {
    // Initialize database first
    await initializeDatabase();
    
    // Then start scheduled tasks
    initScheduledTasks();
    
    console.log('NCRelay server initialized successfully');
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize NCRelay server:', error);
    throw error;
  }
}

// Always run initialization regardless of environment
// This ensures scheduled tasks like queue processing always start
console.log('Initializing NCRelay server and scheduled tasks...');
initializeApp().catch(error => {
  console.error('Failed to initialize NCRelay server:', error);
});
