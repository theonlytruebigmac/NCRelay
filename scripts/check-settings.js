'use strict';

// Simplified script to check system settings
// Import directly from CommonJS file
const { getDB } = require('./src/lib/db');

async function main() {
  console.log('Checking system settings...');
  
  try {
    const db = await getDB();
    console.log('Database connection established');
    
    const result = db.prepare('SELECT * FROM system_settings').all();
    console.log('System settings:', result);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
