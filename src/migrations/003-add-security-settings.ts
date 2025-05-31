import Database from 'better-sqlite3';

const migration = {
  name: 'add-security-settings',
  up: (db: Database.Database): void => {
    // Create the security settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS security_settings (
        id TEXT PRIMARY KEY,
        rateLimitMaxRequests INTEGER NOT NULL,
        rateLimitWindowMs INTEGER NOT NULL,
        maxPayloadSize INTEGER NOT NULL,
        logRetentionDays INTEGER NOT NULL,
        apiRateLimitEnabled INTEGER NOT NULL,
        webhookRateLimitEnabled INTEGER NOT NULL,
        ipWhitelist TEXT NOT NULL,
        enableDetailedErrorLogs INTEGER NOT NULL
      )
    `);

    // Insert default settings
    const rateLimitMaxRequests = process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : 100;
    const rateLimitWindowMs = process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 60000;
    const maxPayloadSize = process.env.MAX_PAYLOAD_SIZE ? parseInt(process.env.MAX_PAYLOAD_SIZE) : 10485760;
    const logRetentionDays = process.env.METRICS_RETENTION_DAYS ? parseInt(process.env.METRICS_RETENTION_DAYS) : 30;

    // Check if there are already settings
    const existingSettings = db.prepare(`
      SELECT id FROM security_settings WHERE id = ?
    `).get('default_security_settings');

    if (!existingSettings) {
      db.prepare(`
        INSERT INTO security_settings 
        (id, rateLimitMaxRequests, rateLimitWindowMs, maxPayloadSize, logRetentionDays, 
         apiRateLimitEnabled, webhookRateLimitEnabled, ipWhitelist, enableDetailedErrorLogs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'default_security_settings',
        rateLimitMaxRequests,
        rateLimitWindowMs,
        maxPayloadSize,
        logRetentionDays,
        1, // apiRateLimitEnabled = true
        0, // webhookRateLimitEnabled = false
        '[]', // ipWhitelist = empty array
        0 // enableDetailedErrorLogs = false
      );
    }
  },
  down: (db: Database.Database): void => {
    db.exec(`DROP TABLE IF EXISTS security_settings;`);
  }
};

export default migration;
