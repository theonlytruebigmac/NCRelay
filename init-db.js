const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = 'app.db';

console.log('Initializing SQLite database...');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    hashedPassword TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`);

// Create integrations table
db.exec(`
  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    webhookUrl TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    targetFormat TEXT NOT NULL DEFAULT 'json',
    createdAt TEXT NOT NULL,
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

// Create api_endpoints table
db.exec(`
  CREATE TABLE IF NOT EXISTS api_endpoints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    associatedIntegrationIds TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`);

// Create logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT
  )
`);

// Create smtp_settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS smtp_settings (
    id TEXT PRIMARY KEY,
    host TEXT,
    port INTEGER,
    secure INTEGER,
    user TEXT,
    pass TEXT,
    from TEXT,
    updatedAt TEXT
  )
`);

// Create password_reset_tokens table
db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

// Create default admin user if it doesn't exist
const adminEmail = 'admin@ncrelay.local';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!existingAdmin) {
  console.log('Creating default admin user...');
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  const adminId = uuidv4();
  
  db.prepare(`
    INSERT INTO users (id, email, name, hashedPassword, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, adminEmail, 'Admin User', hashedPassword, new Date().toISOString());
  
  console.log('Default admin user created:');
  console.log('  Email: admin@ncrelay.local');
  console.log('  Password: admin123');
  console.log('  Please change this password after first login!');
}

// Insert default SMTP settings
const defaultSmtpId = 'default_settings';
const existingSmtp = db.prepare('SELECT id FROM smtp_settings WHERE id = ?').get(defaultSmtpId);

if (!existingSmtp) {
  console.log('Creating default SMTP settings...');
  db.prepare(`
    INSERT INTO smtp_settings (id, host, port, secure, user, pass, from, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(defaultSmtpId, null, null, 0, null, null, null, new Date().toISOString());
}

db.close();
console.log('Database initialization complete!');
console.log('Database file created at:', DB_PATH);

console.log('Initializing SQLite database...');

try {
  const db = new Database(DB_PATH);
  console.log('✓ Database connection established');
  
  db.pragma('journal_mode = WAL');
  console.log('✓ WAL mode enabled');

  // Create users table
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      hashedPassword TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `;

  // Create password reset tokens table
  const createPasswordResetTokensTable = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  // Create integrations table
  const createIntegrationsTable = `
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      webhookUrl TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      targetFormat TEXT NOT NULL
    );
  `;

  // Create API endpoints table
  const createApiEndpointsTable = `
    CREATE TABLE IF NOT EXISTS api_endpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      associatedIntegrationIds TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `;

  // Create request logs table
  const createRequestLogsTable = `
    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      endpointPath TEXT NOT NULL,
      method TEXT NOT NULL,
      payload TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      integrationAttempts TEXT NOT NULL
    );
  `;

  // Create SMTP settings table
  const createSmtpSettingsTable = `
    CREATE TABLE IF NOT EXISTS smtp_settings (
      id TEXT PRIMARY KEY,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      secure INTEGER NOT NULL,
      fromEmail TEXT NOT NULL,
      appBaseUrl TEXT NOT NULL
    );
  `;

  // Execute all table creation statements
  db.exec(createUsersTable);
  console.log('✓ Users table created');
  
  db.exec(createPasswordResetTokensTable);
  console.log('✓ Password reset tokens table created');
  
  db.exec(createIntegrationsTable);
  console.log('✓ Integrations table created');
  
  db.exec(createApiEndpointsTable);
  console.log('✓ API endpoints table created');
  
  db.exec(createRequestLogsTable);
  console.log('✓ Request logs table created');
  
  db.exec(createSmtpSettingsTable);
  console.log('✓ SMTP settings table created');

  // Verify tables were created
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('\n✓ Database tables:', tables.map(t => t.name).join(', '));

  db.close();
  console.log('\n✅ Database initialization completed successfully!');
  console.log(`Database file: ${path.resolve(DB_PATH)}`);

} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  process.exit(1);
}
