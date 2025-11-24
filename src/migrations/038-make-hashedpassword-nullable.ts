import Database from 'better-sqlite3';

/**
 * Make hashedPassword nullable for OAuth users
 * SQLite doesn't support ALTER COLUMN, so we need to recreate the table
 */
const migration = {
  name: 'make-hashedpassword-nullable',

  up: (db: Database.Database): void => {
    console.log('Making hashedPassword nullable for OAuth users...');

    // Disable foreign key constraints temporarily
    db.pragma('foreign_keys = OFF');

    try {
      // Create new users table with nullable hashedPassword
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          hashedPassword TEXT,
          isAdmin INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          provider TEXT DEFAULT 'local',
          providerId TEXT,
          providerAccountId TEXT
        );
      `);

      // Copy data from old table
      db.exec(`
        INSERT INTO users_new (
          id, email, name, hashedPassword, isAdmin, createdAt, updatedAt,
          provider, providerId, providerAccountId
        )
        SELECT 
          id, email, name, hashedPassword, isAdmin, createdAt, updatedAt,
          provider, providerId, providerAccountId
        FROM users;
      `);

      // Drop old table
      db.exec('DROP TABLE users;');

      // Rename new table
      db.exec('ALTER TABLE users_new RENAME TO users;');

      // Recreate index for OAuth lookups
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_provider_providerid 
        ON users(provider, providerId);
      `);

      console.log('✅ Made hashedPassword nullable for OAuth users');
    } finally {
      // Re-enable foreign key constraints
      db.pragma('foreign_keys = ON');
    }
  },

  down: (db: Database.Database): void => {
    console.log('Reverting hashedPassword to NOT NULL...');

    // Disable foreign key constraints temporarily
    db.pragma('foreign_keys = OFF');

    try {
      // Create table with NOT NULL constraint
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          hashedPassword TEXT NOT NULL,
          isAdmin INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          provider TEXT DEFAULT 'local',
          providerId TEXT,
          providerAccountId TEXT
        );
      `);

      // Copy only users with hashedPassword
      db.exec(`
        INSERT INTO users_new (
          id, email, name, hashedPassword, isAdmin, createdAt, updatedAt,
          provider, providerId, providerAccountId
        )
        SELECT 
          id, email, name, hashedPassword, isAdmin, createdAt, updatedAt,
          provider, providerId, providerAccountId
        FROM users
        WHERE hashedPassword IS NOT NULL;
      `);

      // Drop old table
      db.exec('DROP TABLE users;');

      // Rename new table
      db.exec('ALTER TABLE users_new RENAME TO users;');

      // Recreate index
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_provider_providerid 
        ON users(provider, providerId);
      `);

      console.log('⚠️  Reverted hashedPassword to NOT NULL (OAuth users removed)');
    } finally {
      // Re-enable foreign key constraints
      db.pragma('foreign_keys = ON');
    }
  }
};

export default migration;
