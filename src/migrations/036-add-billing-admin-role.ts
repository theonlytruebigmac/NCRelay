import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export const id = 36;
export const name = 'add-billing-admin-role';

export function up(db: Database): void {
  console.log('Adding billing_admin built-in role...');

  // Define the billing_admin role with its permissions
  const billingAdminRole = {
    slug: 'billing_admin',
    name: 'Billing Admin',
    description: 'Manage billing and payments, view resources (read-only)',
    permissions: [
      { resource: 'tenant', action: 'read' },
      { resource: 'users', action: 'read' },
      { resource: 'endpoints', action: 'read' },
      { resource: 'integrations', action: 'read' },
      { resource: 'logs', action: 'read' },
      { resource: 'analytics', action: 'read' },
      { resource: 'billing', action: 'read' },
      { resource: 'billing', action: 'update' },
      { resource: 'settings', action: 'read' },
      { resource: 'field_filters', action: 'read' },
      { resource: 'templates', action: 'read' }
    ]
  };

  // Get the first admin user to use as creator, or use 'system' if no users exist
  const firstUser = db.prepare('SELECT id FROM users WHERE isAdmin = 1 LIMIT 1').get() as any;
  const creatorId = firstUser ? firstUser.id : 'system';

  const now = new Date().toISOString();
  const roleId = `builtin-${billingAdminRole.slug}`;

  // Check if role already exists
  const existingRole = db.prepare(`
    SELECT id FROM custom_roles WHERE id = ?
  `).get(roleId);

  if (!existingRole) {
    // Insert role
    db.prepare(`
      INSERT INTO custom_roles (id, tenantId, name, slug, description, isBuiltIn, createdById, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      roleId,
      'system',
      billingAdminRole.name,
      billingAdminRole.slug,
      billingAdminRole.description,
      creatorId,
      now,
      now
    );

    // Insert permissions for this role
    const insertPermission = db.prepare(`
      INSERT INTO custom_role_permissions (id, roleId, resource, action, allowed, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `);

    for (const perm of billingAdminRole.permissions) {
      const permId = `${roleId}-${perm.resource}-${perm.action}`;
      insertPermission.run(permId, roleId, perm.resource, perm.action, now, now);
    }

    console.log('Billing Admin role added successfully');
  } else {
    console.log('Billing Admin role already exists, skipping');
  }
}

export function down(db: Database): void {
  console.log('Removing billing_admin built-in role...');

  const roleId = 'builtin-billing_admin';

  // Delete permissions
  db.prepare(`
    DELETE FROM custom_role_permissions WHERE roleId = ?
  `).run(roleId);

  // Delete role
  db.prepare(`
    DELETE FROM custom_roles WHERE id = ?
  `).run(roleId);

  console.log('Billing Admin role removed');
}
