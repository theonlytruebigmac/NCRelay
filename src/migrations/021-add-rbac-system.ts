import type { Database } from 'better-sqlite3';

export const id = 21;
export const name = 'add-rbac-system';

export function up(db: Database): void {
  // Update tenant_users role check to include new roles
  // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
  
  // Create new table with updated roles
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_users_new (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'viewer' CHECK(role IN ('owner', 'admin', 'integration_manager', 'endpoint_manager', 'developer', 'viewer')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(tenantId, userId)
    );
  `);

  // Copy data from old table, mapping old 'member' role to 'developer'
  db.exec(`
    INSERT INTO tenant_users_new (id, tenantId, userId, role, createdAt, updatedAt)
    SELECT 
      id, 
      tenantId, 
      userId, 
      CASE role
        WHEN 'member' THEN 'developer'
        ELSE role
      END as role,
      createdAt, 
      updatedAt
    FROM tenant_users;
  `);

  // Drop old table and rename new one
  db.exec(`DROP TABLE tenant_users;`);
  db.exec(`ALTER TABLE tenant_users_new RENAME TO tenant_users;`);

  // Recreate indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenantId);
    CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(userId);
  `);

  // Create permissions table for custom permissions (enterprise feature)
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      role TEXT NOT NULL,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      allowed INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE(tenantId, role, resource, action)
    );
  `);

  // Create index for quick permission lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup 
    ON role_permissions(tenantId, role, resource, action);
  `);

  // Create audit log table for permission changes
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resourceId TEXT,
      changes TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      result TEXT DEFAULT 'success',
      reason TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Create indexes for audit logs
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenantId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resourceId);
  `);

  console.log('RBAC system tables and permissions added successfully');
}

export function down(db: Database): void {
  // Drop new tables
  db.exec(`DROP TABLE IF EXISTS audit_logs;`);
  db.exec(`DROP TABLE IF EXISTS role_permissions;`);

  // Recreate original tenant_users table with old roles
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_users_old (
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

  // Copy data back, mapping new roles to old ones
  db.exec(`
    INSERT INTO tenant_users_old (id, tenantId, userId, role, createdAt, updatedAt)
    SELECT 
      id, 
      tenantId, 
      userId, 
      CASE role
        WHEN 'integration_manager' THEN 'admin'
        WHEN 'endpoint_manager' THEN 'admin'
        WHEN 'developer' THEN 'member'
        ELSE role
      END as role,
      createdAt, 
      updatedAt
    FROM tenant_users;
  `);

  // Drop current table and rename old one
  db.exec(`DROP TABLE tenant_users;`);
  db.exec(`ALTER TABLE tenant_users_old RENAME TO tenant_users;`);

  // Recreate indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenantId);
    CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(userId);
  `);

  console.log('RBAC system tables dropped successfully');
}
