/**
 * Migration to remove targetFormat column from integrations table
 * Since each platform now has a specific format requirement,
 * the targetFormat field is redundant and has been replaced with
 * platform-based format determination.
 */
const migration = {
    name: 'remove-target-format',
    up: (db) => {
        console.log('Starting targetFormat column removal...');
        // SQLite doesn't support DROP COLUMN directly, so we need to:
        // 1. Create a new table without the targetFormat column
        // 2. Copy data from old table to new table  
        // 3. Drop old table
        // 4. Rename new table
        try {
            // Clean up any existing temporary table first
            db.exec(`DROP TABLE IF EXISTS integrations_new`);
            // Create new integrations table without targetFormat
            db.exec(`
        CREATE TABLE integrations_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          platform TEXT NOT NULL,
          webhookUrl TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT 1,
          fieldFilterId TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (fieldFilterId) REFERENCES field_filters (id) ON DELETE SET NULL
        )
      `);
            // Copy data from old table (excluding targetFormat and legacy columns)
            db.exec(`
        INSERT INTO integrations_new (id, name, platform, webhookUrl, enabled, fieldFilterId, createdAt, updatedAt)
        SELECT 
          id, 
          name, 
          platform, 
          webhookUrl, 
          enabled, 
          field_filter_id as fieldFilterId,
          COALESCE(createdAt, datetime('now')) as createdAt,
          datetime('now') as updatedAt
        FROM integrations
      `);
            // Drop old table
            db.exec(`DROP TABLE integrations`);
            // Rename new table
            db.exec(`ALTER TABLE integrations_new RENAME TO integrations`);
            // Recreate indexes if any existed
            db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform)`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled)`);
            console.log('Successfully removed targetFormat column');
        }
        catch (error) {
            console.error('Error during migration:', error);
            throw error;
        }
    },
    down: (db) => {
        console.log('Rolling back targetFormat column removal...');
        try {
            // Clean up any existing temporary table first
            db.exec(`DROP TABLE IF EXISTS integrations_new`);
            // Create table with targetFormat column restored
            db.exec(`
        CREATE TABLE integrations_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          platform TEXT NOT NULL,
          webhookUrl TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT 1,
          targetFormat TEXT NOT NULL DEFAULT 'json',
          fieldFilterId TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (fieldFilterId) REFERENCES field_filters (id) ON DELETE SET NULL
        )
      `);
            // Copy data and set default targetFormat based on platform
            db.exec(`
        INSERT INTO integrations_new (id, name, platform, webhookUrl, enabled, targetFormat, fieldFilterId, createdAt, updatedAt)
        SELECT 
          id, 
          name, 
          platform, 
          webhookUrl, 
          enabled,
          CASE 
            WHEN platform = 'teams' THEN 'json'
            WHEN platform = 'slack' THEN 'json'
            WHEN platform = 'discord' THEN 'json'
            ELSE 'json'
          END as targetFormat,
          fieldFilterId, 
          createdAt, 
          updatedAt
        FROM integrations
      `);
            // Drop current table
            db.exec(`DROP TABLE integrations`);
            // Rename new table
            db.exec(`ALTER TABLE integrations_new RENAME TO integrations`);
            // Recreate indexes
            db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform)`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled)`);
            console.log('Successfully restored targetFormat column');
        }
        catch (error) {
            console.error('Error during rollback:', error);
            throw error;
        }
    }
};
export default migration;
