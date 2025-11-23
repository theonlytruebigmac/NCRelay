import type { Database } from 'better-sqlite3';

export const id = 20;
export const name = 'add-multi-tenancy';

export function up(db: Database): void {
  // Create tenants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      domain TEXT UNIQUE,
      plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
      maxEndpoints INTEGER DEFAULT 5,
      maxIntegrations INTEGER DEFAULT 10,
      maxRequestsPerMonth INTEGER DEFAULT 10000,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      expiresAt TEXT
    );
  `);

  // Create tenant_users junction table for multi-tenant user access
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_users (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(tenantId, userId)
    );
  `);

  // Create indexes for tenant_users
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenantId);
    CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(userId);
  `);

  // Add tenantId to existing tables
  const tablesToUpdate = [
    'api_endpoints',
    'integrations',
    'field_filters',
    'request_logs',
    'notification_queue',
    'notification_preferences'
  ];

  for (const table of tablesToUpdate) {
    // Check if column exists before adding
    const columnExists = db.prepare(`
      SELECT COUNT(*) as count 
      FROM pragma_table_info('${table}') 
      WHERE name = 'tenantId'
    `).get() as { count: number };

    if (columnExists.count === 0) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN tenantId TEXT;`);
      
      // Create index for performance
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenantId);`);
    }
  }

  // Special handling for users table - don't add tenantId as users can belong to multiple tenants
  // That's handled by the tenant_users junction table

  console.log('Multi-tenancy tables and columns added successfully');
}

export function down(db: Database): void {
  // Drop indexes
  const tablesToUpdate = [
    'api_endpoints',
    'integrations',
    'field_filters',
    'request_logs',
    'notification_queue',
    'notification_preferences'
  ];

  for (const table of tablesToUpdate) {
    db.exec(`DROP INDEX IF EXISTS idx_${table}_tenant;`);
  }

  // Drop tenant-related indexes
  db.exec(`DROP INDEX IF EXISTS idx_tenant_users_tenant;`);
  db.exec(`DROP INDEX IF EXISTS idx_tenant_users_user;`);

  // Drop tables
  db.exec(`DROP TABLE IF EXISTS tenant_users;`);
  db.exec(`DROP TABLE IF EXISTS tenants;`);

  // Note: We don't remove tenantId columns from existing tables in down migration
  // as SQLite doesn't support dropping columns easily and it's safer to leave them

  console.log('Multi-tenancy tables dropped successfully');
}
