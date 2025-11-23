import { Database } from 'better-sqlite3';

export async function up(db: Database) {
  console.log('Running migration 024: Add sessionToken to user_sessions...');
  
  // Add sessionToken column to user_sessions table
  db.exec(`
    ALTER TABLE user_sessions ADD COLUMN sessionToken TEXT;
  `);
  
  // Create index on sessionToken for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(sessionToken);
  `);

  console.log('✅ Migration 024: Added sessionToken column to user_sessions');
}

export async function down(db: Database) {
  console.log('Rolling back migration 024...');
  
  // SQLite doesn't support dropping columns directly
  // We'd need to recreate the table without the column
  db.exec(`
    DROP INDEX IF EXISTS idx_sessions_token;
  `);
  
  // Note: To fully roll back, you'd need to recreate the table
  // without the sessionToken column, but that's complex in SQLite
  
  console.log('✅ Migration 024 rolled back (index dropped)');
}

const migration = {
  name: 'add-session-token',
  up,
  down,
};

export default migration;
