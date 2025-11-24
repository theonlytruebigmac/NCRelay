import type { Database } from 'better-sqlite3';

export const id = 22;
export const name = 'add-custom-roles';

export function up(db: Database): void {
  // Create custom_roles table for tenant-specific custom roles
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_roles (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      isBuiltIn INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdById TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(tenantId, slug)
    );
  `);

  // Create index for custom roles
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_custom_roles_tenant ON custom_roles(tenantId);
    CREATE INDEX IF NOT EXISTS idx_custom_roles_slug ON custom_roles(slug);
  `);

  // Create custom_role_permissions table for granular permissions
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_role_permissions (
      id TEXT PRIMARY KEY,
      roleId TEXT NOT NULL,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      allowed INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (roleId) REFERENCES custom_roles(id) ON DELETE CASCADE,
      UNIQUE(roleId, resource, action)
    );
  `);

  // Create index for custom role permissions
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_custom_role_permissions_role ON custom_role_permissions(roleId);
    CREATE INDEX IF NOT EXISTS idx_custom_role_permissions_lookup ON custom_role_permissions(roleId, resource, action);
  `);

  // Update tenant_users to support custom roles
  // We'll keep the role column for built-in roles and add a customRoleId for custom roles
  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(tenant_users)").all() as any[];
  const hasCustomRoleId = tableInfo.some(col => col.name === 'customRoleId');
  
  if (!hasCustomRoleId) {
    db.exec(`
      ALTER TABLE tenant_users ADD COLUMN customRoleId TEXT REFERENCES custom_roles(id) ON DELETE SET NULL;
    `);
  }

  // Create index for custom role assignments
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tenant_users_custom_role ON tenant_users(customRoleId);
  `);

  // Define built-in roles with their permissions
  const builtInRoles = [
    {
      slug: 'owner',
      name: 'Owner',
      description: 'Full access to all tenant resources and settings',
      permissions: [
        { resource: 'tenant', action: 'read' }, { resource: 'tenant', action: 'update' }, { resource: 'tenant', action: 'delete' },
        { resource: 'users', action: 'create' }, { resource: 'users', action: 'read' }, { resource: 'users', action: 'update' }, { resource: 'users', action: 'delete' }, { resource: 'users', action: 'manage' },
        { resource: 'endpoints', action: 'create' }, { resource: 'endpoints', action: 'read' }, { resource: 'endpoints', action: 'update' }, { resource: 'endpoints', action: 'delete' },
        { resource: 'integrations', action: 'create' }, { resource: 'integrations', action: 'read' }, { resource: 'integrations', action: 'update' }, { resource: 'integrations', action: 'delete' },
        { resource: 'logs', action: 'read' }, { resource: 'webhooks', action: 'test' }, { resource: 'analytics', action: 'read' },
        { resource: 'billing', action: 'read' }, { resource: 'billing', action: 'update' },
        { resource: 'settings', action: 'read' }, { resource: 'settings', action: 'update' },
        { resource: 'field_filters', action: 'create' }, { resource: 'field_filters', action: 'read' }, { resource: 'field_filters', action: 'update' }, { resource: 'field_filters', action: 'delete' },
        { resource: 'templates', action: 'create' }, { resource: 'templates', action: 'read' }, { resource: 'templates', action: 'update' }, { resource: 'templates', action: 'delete' }
      ]
    },
    {
      slug: 'admin',
      name: 'Administrator',
      description: 'Manage most resources except billing and tenant deletion',
      permissions: [
        { resource: 'tenant', action: 'read' }, { resource: 'tenant', action: 'update' },
        { resource: 'users', action: 'create' }, { resource: 'users', action: 'read' }, { resource: 'users', action: 'update' }, { resource: 'users', action: 'delete' }, { resource: 'users', action: 'manage' },
        { resource: 'endpoints', action: 'create' }, { resource: 'endpoints', action: 'read' }, { resource: 'endpoints', action: 'update' }, { resource: 'endpoints', action: 'delete' },
        { resource: 'integrations', action: 'create' }, { resource: 'integrations', action: 'read' }, { resource: 'integrations', action: 'update' }, { resource: 'integrations', action: 'delete' },
        { resource: 'logs', action: 'read' }, { resource: 'webhooks', action: 'test' }, { resource: 'analytics', action: 'read' },
        { resource: 'settings', action: 'read' }, { resource: 'settings', action: 'update' },
        { resource: 'field_filters', action: 'create' }, { resource: 'field_filters', action: 'read' }, { resource: 'field_filters', action: 'update' }, { resource: 'field_filters', action: 'delete' },
        { resource: 'templates', action: 'create' }, { resource: 'templates', action: 'read' }, { resource: 'templates', action: 'update' }, { resource: 'templates', action: 'delete' }
      ]
    },
    {
      slug: 'integration_manager',
      name: 'Integration Manager',
      description: 'Manage integrations, filters, and templates',
      permissions: [
        { resource: 'tenant', action: 'read' }, { resource: 'users', action: 'read' }, { resource: 'endpoints', action: 'read' },
        { resource: 'integrations', action: 'create' }, { resource: 'integrations', action: 'read' }, { resource: 'integrations', action: 'update' }, { resource: 'integrations', action: 'delete' },
        { resource: 'logs', action: 'read' }, { resource: 'webhooks', action: 'test' }, { resource: 'analytics', action: 'read' },
        { resource: 'field_filters', action: 'create' }, { resource: 'field_filters', action: 'read' }, { resource: 'field_filters', action: 'update' }, { resource: 'field_filters', action: 'delete' },
        { resource: 'templates', action: 'create' }, { resource: 'templates', action: 'read' }, { resource: 'templates', action: 'update' }, { resource: 'templates', action: 'delete' }
      ]
    },
    {
      slug: 'endpoint_manager',
      name: 'Endpoint Manager',
      description: 'Manage endpoints and view integrations',
      permissions: [
        { resource: 'tenant', action: 'read' }, { resource: 'users', action: 'read' },
        { resource: 'endpoints', action: 'create' }, { resource: 'endpoints', action: 'read' }, { resource: 'endpoints', action: 'update' }, { resource: 'endpoints', action: 'delete' },
        { resource: 'integrations', action: 'read' }, { resource: 'logs', action: 'read' }, { resource: 'webhooks', action: 'test' }, { resource: 'analytics', action: 'read' },
        { resource: 'field_filters', action: 'read' }, { resource: 'templates', action: 'read' }
      ]
    },
    {
      slug: 'developer',
      name: 'Developer',
      description: 'Access endpoints, integrations, and logs',
      permissions: [
        { resource: 'tenant', action: 'read' }, { resource: 'users', action: 'read' },
        { resource: 'endpoints', action: 'read' }, { resource: 'integrations', action: 'read' },
        { resource: 'logs', action: 'read' }, { resource: 'webhooks', action: 'test' }, { resource: 'analytics', action: 'read' },
        { resource: 'field_filters', action: 'read' }, { resource: 'templates', action: 'read' }
      ]
    },
    {
      slug: 'viewer',
      name: 'Viewer',
      description: 'Read-only access to most resources',
      permissions: [
        { resource: 'tenant', action: 'read' }, { resource: 'users', action: 'read' },
        { resource: 'endpoints', action: 'read' }, { resource: 'integrations', action: 'read' },
        { resource: 'analytics', action: 'read' }, { resource: 'field_filters', action: 'read' }, { resource: 'templates', action: 'read' }
      ]
    }
  ];

  // Get the first admin user to use as creator, or use 'system' if no users exist
  const firstUser = db.prepare('SELECT id FROM users WHERE isAdmin = 1 LIMIT 1').get() as any;
  const creatorId = firstUser ? firstUser.id : 'system';

  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO custom_roles (id, tenantId, name, slug, description, isBuiltIn, createdById, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);

  const insertPermission = db.prepare(`
    INSERT OR IGNORE INTO custom_role_permissions (id, roleId, resource, action, allowed, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `);

  // We'll insert these as built-in for the system (tenantId = 'system')
  const now = new Date().toISOString();
  
  for (const role of builtInRoles) {
    const roleId = `builtin-${role.slug}`;
    
    // Insert role
    insertRole.run(
      roleId,
      'system',
      role.name,
      role.slug,
      role.description,
      creatorId,
      now,
      now
    );

    // Insert permissions for this role
    for (const perm of role.permissions) {
      const permId = `${roleId}-${perm.resource}-${perm.action}`;
      insertPermission.run(permId, roleId, perm.resource, perm.action, now, now);
    }
  }

  console.log('Custom roles system added successfully');
}

export function down(db: Database): void {
  // Remove custom role column from tenant_users
  // SQLite doesn't support DROP COLUMN directly in older versions
  // We'll need to recreate the table without the column
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_users_temp (
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

  // Copy data (excluding customRoleId)
  db.exec(`
    INSERT INTO tenant_users_temp (id, tenantId, userId, role, createdAt, updatedAt)
    SELECT id, tenantId, userId, role, createdAt, updatedAt
    FROM tenant_users;
  `);

  // Drop old table and rename
  db.exec(`DROP TABLE tenant_users;`);
  db.exec(`ALTER TABLE tenant_users_temp RENAME TO tenant_users;`);

  // Recreate indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenantId);
    CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(userId);
  `);

  // Drop custom role tables
  db.exec(`DROP TABLE IF EXISTS custom_role_permissions;`);
  db.exec(`DROP TABLE IF EXISTS custom_roles;`);

  console.log('Custom roles system removed successfully');
}
