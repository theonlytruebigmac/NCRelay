import { initScheduledTasks } from './lib/scheduled-tasks';

// This file will be imported on server startup only

// Initialize scheduled tasks
initScheduledTasks();

console.log('NCRelay server initialized - scheduled tasks started');
