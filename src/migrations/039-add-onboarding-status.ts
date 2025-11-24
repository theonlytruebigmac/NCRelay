import Database from 'better-sqlite3';

/**
 * Add onboarding status tracking for new users
 */
const migration = {
  name: 'add-onboarding-status',

  up: (db: Database.Database): void => {
    console.log('Adding onboarding status to users table...');

    // Add onboardingCompleted column to track if user has completed setup
    db.exec(`
      ALTER TABLE users ADD COLUMN onboardingCompleted INTEGER DEFAULT 0;
    `);

    // Mark all existing users as having completed onboarding
    // (they were created by admins and don't need onboarding)
    db.exec(`
      UPDATE users SET onboardingCompleted = 1;
    `);

    console.log('✅ Added onboarding status tracking');
  },

  down: (db: Database.Database): void => {
    console.log('⚠️  SQLite does not support DROP COLUMN - onboardingCompleted column will remain');
  }
};

export default migration;
