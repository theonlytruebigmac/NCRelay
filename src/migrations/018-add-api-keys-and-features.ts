import Database from 'better-sqlite3';

/**
 * Add API keys, templates, alert settings, and configuration export tables
 */
const migration = {
  name: 'add-api-keys-and-features',

  up: (db: Database.Database): void => {
    db.exec(`
      -- API Keys table for endpoint authentication
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        endpointId TEXT NOT NULL,
        keyHash TEXT NOT NULL,
        name TEXT NOT NULL,
        lastUsedAt TEXT,
        enabled INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        expiresAt TEXT,
        FOREIGN KEY (endpointId) REFERENCES api_endpoints(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_api_keys_endpoint ON api_keys(endpointId);
      CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys(enabled);

      -- Notification Templates table
      CREATE TABLE IF NOT EXISTS notification_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        template TEXT NOT NULL,
        engine TEXT DEFAULT 'handlebars',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      -- Alert Settings table
      CREATE TABLE IF NOT EXISTS alert_settings (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        threshold INTEGER,
        recipients TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      -- User Preferences table
      CREATE TABLE IF NOT EXISTS user_preferences (
        userId TEXT PRIMARY KEY,
        theme TEXT DEFAULT 'system',
        dashboardRefreshInterval INTEGER DEFAULT 30000,
        notificationsEnabled INTEGER DEFAULT 1,
        preferences TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Add webhook signing to integrations
      ALTER TABLE integrations ADD COLUMN signingSecret TEXT;
      ALTER TABLE integrations ADD COLUMN signWebhooks INTEGER DEFAULT 0;

      -- Add parallel delivery setting to integrations
      ALTER TABLE integrations ADD COLUMN maxConcurrency INTEGER DEFAULT 1;

      -- Add template support to integrations
      ALTER TABLE integrations ADD COLUMN templateId TEXT;

      -- Add API key requirement to endpoints
      ALTER TABLE api_endpoints ADD COLUMN requireApiKey INTEGER DEFAULT 0;

      -- Add tags/categories for bulk operations
      ALTER TABLE integrations ADD COLUMN tags TEXT;
      ALTER TABLE api_endpoints ADD COLUMN tags TEXT;

      -- Metrics cache table
      CREATE TABLE IF NOT EXISTS metrics_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_cache_expires ON metrics_cache(expiresAt);
    `);
  },

  down: (db: Database.Database): void => {
    db.exec(`
      DROP TABLE IF EXISTS api_keys;
      DROP TABLE IF EXISTS notification_templates;
      DROP TABLE IF EXISTS alert_settings;
      DROP TABLE IF EXISTS user_preferences;
      DROP TABLE IF EXISTS metrics_cache;

      -- Note: SQLite doesn't support DROP COLUMN easily
      -- In production, you'd need to recreate tables without these columns
    `);
  }
};

export default migration;
