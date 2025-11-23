#!/usr/bin/env node

/**
 * Script to reset admin password
 * Usage: node scripts/reset-admin-password.js
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error('Error: INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set in .env.development');
  process.exit(1);
}

console.log('Resetting admin password...');
console.log('Email:', adminEmail);

const db = new Database('app.db');

// Check if user exists
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!user) {
  console.error('✗ Admin user not found!');
  db.close();
  process.exit(1);
}

// Update password
const hashedPassword = await bcrypt.hash(adminPassword, 10);
const now = new Date().toISOString();

db.prepare(`
  UPDATE users 
  SET hashedPassword = ?, updatedAt = ?
  WHERE email = ?
`).run(hashedPassword, now, adminEmail);

console.log('✓ Admin password reset successfully!');
console.log('You can now log in with:');
console.log('  Email:', adminEmail);
console.log('  Password:', adminPassword);

db.close();
