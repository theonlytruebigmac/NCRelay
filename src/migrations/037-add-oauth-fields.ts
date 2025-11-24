import Database from 'better-sqlite3';

/**
 * Add OAuth provider fields to users table
 * This allows users to sign in with Google or local credentials
 */
const migration = {
  name: 'add-oauth-fields',

  up: (db: Database.Database): void => {
    // Add OAuth provider fields to users table
    db.exec(`
      -- Provider type (local, google)
      ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'local';
      
      -- Unique ID from the OAuth provider
      ALTER TABLE users ADD COLUMN providerId TEXT;
      
      -- Account linking - store provider account ID
      ALTER TABLE users ADD COLUMN providerAccountId TEXT;
      
      -- Make hashedPassword optional for OAuth users
      -- Note: SQLite doesn't support modifying column constraints directly
      -- We'll handle this in application logic by allowing NULL hashedPassword for OAuth users
    `);

    // Create index for OAuth lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_provider_providerid 
      ON users(provider, providerId);
    `);

    // Update existing users to have 'local' provider
    db.exec(`
      UPDATE users 
      SET provider = 'local' 
      WHERE provider IS NULL;
    `);

    console.log('✅ Added OAuth provider fields to users table');
  },

  down: (db: Database.Database): void => {
    // Note: SQLite doesn't support DROP COLUMN directly
    // In a real rollback scenario, you'd need to recreate the table
    db.exec(`
      DROP INDEX IF EXISTS idx_users_provider_providerid;
    `);
    
    console.log('⚠️  Rolled back OAuth fields (columns remain due to SQLite limitations)');
  }
};

export default migration;
