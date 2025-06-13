import Database from 'better-sqlite3';

const migration = {
  name: 'add-notification-preferences',
  up: (db: Database.Database): void => {
    // Create notification preferences table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        userId TEXT PRIMARY KEY,
        emailNotifications BOOLEAN NOT NULL DEFAULT 1,
        systemNotifications BOOLEAN NOT NULL DEFAULT 1,
        importantOnly BOOLEAN NOT NULL DEFAULT 0,
        failureNotificationsOnly BOOLEAN NOT NULL DEFAULT 1,
        emailDigestFrequency TEXT NOT NULL DEFAULT 'never',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  },
  down: (db: Database.Database): void => {
    db.exec(`DROP TABLE IF EXISTS notification_preferences;`);
  },
};

export default migration;
