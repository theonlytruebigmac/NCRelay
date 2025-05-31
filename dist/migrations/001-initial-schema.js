const migration = {
    name: 'initial-schema',
    up: (db) => {
        // Create users table
        db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        hashedPassword TEXT NOT NULL,
        isAdmin INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
        // Create password reset tokens table
        db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expiresAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
        // Create integrations table
        db.exec(`
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        webhookUrl TEXT NOT NULL, -- Will be encrypted
        enabled INTEGER NOT NULL,
        targetFormat TEXT NOT NULL,
        createdAt TEXT,
        userId TEXT
      );
    `);
        // Create API endpoints table
        db.exec(`
      CREATE TABLE IF NOT EXISTS api_endpoints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        associatedIntegrationIds TEXT NOT NULL, -- JSON string array
        createdAt TEXT NOT NULL -- ISO8601 string
      );
    `);
        // Create request logs table
        db.exec(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL, -- ISO8601 string
        apiEndpointId TEXT,
        apiEndpointName TEXT,
        apiEndpointPath TEXT NOT NULL,
        incomingRequestIp TEXT,
        incomingRequestMethod TEXT NOT NULL,
        incomingRequestHeaders TEXT NOT NULL, -- JSON string, will be encrypted
        incomingRequestBodyRaw TEXT NOT NULL, -- Will be encrypted
        processingOverallStatus TEXT NOT NULL,
        processingMessage TEXT NOT NULL,
        integrationAttempts TEXT -- JSON string array of LoggedIntegrationAttempt, will be encrypted
      );
    `);
        // Create SMTP settings table
        db.exec(`
      CREATE TABLE IF NOT EXISTS smtp_settings (
        id TEXT PRIMARY KEY, -- Should always be 'default_settings'
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        user TEXT NOT NULL,
        password TEXT NOT NULL, -- Encrypted
        secure INTEGER NOT NULL, -- Boolean (0 or 1)
        fromEmail TEXT NOT NULL,
        appBaseUrl TEXT NOT NULL
      );
    `);
    },
    down: (db) => {
        // Drop all tables in reverse order
        db.exec(`
      DROP TABLE IF EXISTS smtp_settings;
      DROP TABLE IF EXISTS request_logs;
      DROP TABLE IF EXISTS api_endpoints;
      DROP TABLE IF EXISTS integrations;
      DROP TABLE IF EXISTS password_reset_tokens;
      DROP TABLE IF EXISTS users;
    `);
    }
};
export default migration;
