#!/usr/bin/env node

/**
 * Script to manually create the initial admin user
 * Usage: node scripts/create-admin.js
 */

import { initializeDatabase } from '../src/lib/db.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

console.log('Creating initial admin user...');
console.log('Email:', process.env.INITIAL_ADMIN_EMAIL);

try {
  await initializeDatabase();
  console.log('✓ Admin user created successfully!');
  process.exit(0);
} catch (error) {
  console.error('✗ Error creating admin user:', error.message);
  process.exit(1);
}
