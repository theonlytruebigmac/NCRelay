export const migration = {
    name: 'add-system-settings',
    up: (db) => {
        // Create the system settings table
        db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updatedAt TEXT NOT NULL
      )
    `);
        // Add index on key for faster lookups
        db.exec(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key)
    `);
        // Insert queue processing settings (enabled by default)
        const now = new Date().toISOString();
        db.prepare(`
      INSERT OR IGNORE INTO system_settings (id, key, value, description, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run('queue_processing_enabled', 'queue_processing_enabled', 'true', 'Controls whether the notification queue processing is active', now);
    },
    down: (db) => {
        // Remove queue processing setting
        db.prepare(`
      DELETE FROM system_settings WHERE key = ?
    `).run('queue_processing_enabled');
        // Check if there are any other settings left
        const count = db.prepare(`
      SELECT COUNT(*) as count FROM system_settings
    `).get();
        // If no other settings exist, drop the table
        if (count.count === 0) {
            db.exec(`DROP TABLE IF EXISTS system_settings`);
            db.exec(`DROP INDEX IF EXISTS idx_system_settings_key`);
        }
    }
};
export default migration;
