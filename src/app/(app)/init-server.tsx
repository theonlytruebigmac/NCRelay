import { ReactNode } from 'react';

// Import this code only on the server side
import { headers } from 'next/headers';
import { initScheduledTasks } from '@/lib/scheduled-tasks';

// Initialization flag
let initialized = false;

function initServer() {
  // Only run once
  if (!initialized) {
    // Initialize scheduled tasks for log retention and backups
    initScheduledTasks();
    initialized = true;
    console.log('Initialized server-side tasks');
  }
}

export default function InitServer() {
  // This forces the function to be executed on the server
  headers();
  
  // Initialize server (only runs on the server)
  if (typeof window === 'undefined') {
    initServer();
  }
  
  return null;
}
