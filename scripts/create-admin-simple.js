#!/usr/bin/env node

/**
 * Script to manually create the initial admin user
 * Usage: node scripts/create-admin-simple.js
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
const adminName = process.env.INITIAL_ADMIN_NAME || 'Admin User';

if (!adminEmail || !adminPassword) {
  console.error('Error: INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set in .env.development');
  process.exit(1);
}

console.log('Creating initial admin user...');
console.log('Email:', adminEmail);
console.log('Name:', adminName);

const db = new Database('app.db');

// Check if user already exists
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (existing) {
  console.log('✓ Admin user already exists');
  db.close();
  process.exit(0);
}

// Create new admin user
const hashedPassword = await bcrypt.hash(adminPassword, 10);
const userId = randomUUID();
const now = new Date().toISOString();

db.prepare(`
  INSERT INTO users (id, email, name, hashedPassword, isAdmin, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(userId, adminEmail, adminName, hashedPassword, 1, now, now);

// Create default notification preferences
db.prepare(`
  INSERT INTO notification_preferences (userId, emailNotifications, systemNotifications, importantOnly, failureNotificationsOnly, emailDigestFrequency, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(userId, 1, 1, 0, 1, 'never', now, now);

console.log('✓ Admin user created successfully!');
console.log('You can now log in with:');
console.log('  Email:', adminEmail);
console.log('  Password:', adminPassword);

db.close();
