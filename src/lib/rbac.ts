import type { Resource, Action, TenantUserRole, Permission, PermissionCheck } from './types';
import { getDB } from './db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Default permission matrix for all roles
 * True means the role has permission for that resource+action
 */
const DEFAULT_PERMISSIONS: Record<TenantUserRole, Permission[]> = {
  owner: [
    // Owners have full access to everything
    { resource: 'tenant', action: 'read', allowed: true },
    { resource: 'tenant', action: 'update', allowed: true },
    { resource: 'tenant', action: 'delete', allowed: true },
    { resource: 'users', action: 'create', allowed: true },
    { resource: 'users', action: 'read', allowed: true },
    { resource: 'users', action: 'update', allowed: true },
    { resource: 'users', action: 'delete', allowed: true },
    { resource: 'users', action: 'manage', allowed: true },
    { resource: 'endpoints', action: 'create', allowed: true },
    { resource: 'endpoints', action: 'read', allowed: true },
    { resource: 'endpoints', action: 'update', allowed: true },
    { resource: 'endpoints', action: 'delete', allowed: true },
    { resource: 'integrations', action: 'create', allowed: true },
    { resource: 'integrations', action: 'read', allowed: true },
    { resource: 'integrations', action: 'update', allowed: true },
    { resource: 'integrations', action: 'delete', allowed: true },
    { resource: 'logs', action: 'read', allowed: true },
    { resource: 'webhooks', action: 'test', allowed: true },
    { resource: 'analytics', action: 'read', allowed: true },
    { resource: 'billing', action: 'read', allowed: true },
    { resource: 'billing', action: 'update', allowed: true },
    { resource: 'settings', action: 'read', allowed: true },
    { resource: 'settings', action: 'update', allowed: true },
    { resource: 'field_filters', action: 'create', allowed: true },
    { resource: 'field_filters', action: 'read', allowed: true },
    { resource: 'field_filters', action: 'update', allowed: true },
    { resource: 'field_filters', action: 'delete', allowed: true },
    { resource: 'templates', action: 'create', allowed: true },
    { resource: 'templates', action: 'read', allowed: true },
    { resource: 'templates', action: 'update', allowed: true },
    { resource: 'templates', action: 'delete', allowed: true },
  ],
  admin: [
    // Admins can manage most things except billing and tenant deletion
    { resource: 'tenant', action: 'read', allowed: true },
    { resource: 'tenant', action: 'update', allowed: true },
    { resource: 'users', action: 'create', allowed: true },
    { resource: 'users', action: 'read', allowed: true },
    { resource: 'users', action: 'update', allowed: true },
    { resource: 'users', action: 'delete', allowed: true },
    { resource: 'users', action: 'manage', allowed: true },
    { resource: 'endpoints', action: 'create', allowed: true },
    { resource: 'endpoints', action: 'read', allowed: true },
    { resource: 'endpoints', action: 'update', allowed: true },
    { resource: 'endpoints', action: 'delete', allowed: true },
    { resource: 'integrations', action: 'create', allowed: true },
    { resource: 'integrations', action: 'read', allowed: true },
    { resource: 'integrations', action: 'update', allowed: true },
    { resource: 'integrations', action: 'delete', allowed: true },
    { resource: 'logs', action: 'read', allowed: true },
    { resource: 'webhooks', action: 'test', allowed: true },
    { resource: 'analytics', action: 'read', allowed: true },
    { resource: 'settings', action: 'read', allowed: true },
    { resource: 'settings', action: 'update', allowed: true },
    { resource: 'field_filters', action: 'create', allowed: true },
    { resource: 'field_filters', action: 'read', allowed: true },
    { resource: 'field_filters', action: 'update', allowed: true },
    { resource: 'field_filters', action: 'delete', allowed: true },
    { resource: 'templates', action: 'create', allowed: true },
    { resource: 'templates', action: 'read', allowed: true },
    { resource: 'templates', action: 'update', allowed: true },
    { resource: 'templates', action: 'delete', allowed: true },
  ],
  integration_manager: [
    // Can manage integrations and related resources
    { resource: 'tenant', action: 'read', allowed: true },
    { resource: 'users', action: 'read', allowed: true },
    { resource: 'endpoints', action: 'read', allowed: true },
    { resource: 'integrations', action: 'create', allowed: true },
    { resource: 'integrations', action: 'read', allowed: true },
    { resource: 'integrations', action: 'update', allowed: true },
    { resource: 'integrations', action: 'delete', allowed: true },
    { resource: 'logs', action: 'read', allowed: true },
    { resource: 'webhooks', action: 'test', allowed: true },
    { resource: 'analytics', action: 'read', allowed: true },
    { resource: 'field_filters', action: 'create', allowed: true },
    { resource: 'field_filters', action: 'read', allowed: true },
    { resource: 'field_filters', action: 'update', allowed: true },
    { resource: 'field_filters', action: 'delete', allowed: true },
    { resource: 'templates', action: 'create', allowed: true },
    { resource: 'templates', action: 'read', allowed: true },
    { resource: 'templates', action: 'update', allowed: true },
    { resource: 'templates', action: 'delete', allowed: true },
  ],
  endpoint_manager: [
    // Can manage endpoints and view integrations
    { resource: 'tenant', action: 'read', allowed: true },
    { resource: 'users', action: 'read', allowed: true },
    { resource: 'endpoints', action: 'create', allowed: true },
    { resource: 'endpoints', action: 'read', allowed: true },
    { resource: 'endpoints', action: 'update', allowed: true },
    { resource: 'endpoints', action: 'delete', allowed: true },
    { resource: 'integrations', action: 'read', allowed: true },
    { resource: 'logs', action: 'read', allowed: true },
    { resource: 'webhooks', action: 'test', allowed: true },
    { resource: 'analytics', action: 'read', allowed: true },
    { resource: 'field_filters', action: 'read', allowed: true },
    { resource: 'templates', action: 'read', allowed: true },
  ],
  developer: [
    // Can test webhooks and view logs
    { resource: 'tenant', action: 'read', allowed: true },
    { resource: 'users', action: 'read', allowed: true },
    { resource: 'endpoints', action: 'read', allowed: true },
    { resource: 'integrations', action: 'read', allowed: true },
    { resource: 'logs', action: 'read', allowed: true },
    { resource: 'webhooks', action: 'test', allowed: true },
    { resource: 'analytics', action: 'read', allowed: true },
    { resource: 'field_filters', action: 'read', allowed: true },
    { resource: 'templates', action: 'read', allowed: true },
  ],
  viewer: [
    // Read-only access to most resources
    { resource: 'tenant', action: 'read', allowed: true },
    { resource: 'users', action: 'read', allowed: true },
    { resource: 'endpoints', action: 'read', allowed: true },
    { resource: 'integrations', action: 'read', allowed: true },
    { resource: 'analytics', action: 'read', allowed: true },
    { resource: 'field_filters', action: 'read', allowed: true },
    { resource: 'templates', action: 'read', allowed: true },
  ],
};

/**
 * Check if a user has permission to perform an action on a resource
 */
export async function checkPermission(
  role: TenantUserRole,
  resource: Resource,
  action: Action,
  tenantId?: string
): Promise<PermissionCheck> {
  // First check default permissions
  const defaultPerms = DEFAULT_PERMISSIONS[role] || [];
  const defaultPerm = defaultPerms.find(
    (p) => p.resource === resource && p.action === action
  );

  // If no tenant ID provided, use default permissions only
  if (!tenantId) {
    return {
      allowed: defaultPerm?.allowed || false,
      reason: defaultPerm?.allowed
        ? undefined
        : `Role ${role} does not have ${action} permission for ${resource}`,
    };
  }

  // Check custom permissions in database (for enterprise plans)
  try {
    const db = await getDB();
    const customPerm = db
      .prepare(
        `SELECT allowed FROM role_permissions 
         WHERE tenantId = ? AND role = ? AND resource = ? AND action = ?`
      )
      .get(tenantId, role, resource, action) as { allowed: number } | undefined;

    if (customPerm !== undefined) {
      return {
        allowed: customPerm.allowed === 1,
        reason: customPerm.allowed === 1
          ? undefined
          : `Custom permission denies ${action} on ${resource} for role ${role}`,
      };
    }
  } catch (error) {
    console.error('Error checking custom permissions:', error);
  }

  // Fall back to default permissions
  return {
    allowed: defaultPerm?.allowed || false,
    reason: defaultPerm?.allowed
      ? undefined
      : `Role ${role} does not have ${action} permission for ${resource}`,
  };
}

/**
 * Get all permissions for a role
 */
export async function getRolePermissions(
  role: TenantUserRole,
  tenantId?: string
): Promise<Permission[]> {
  const defaultPerms = DEFAULT_PERMISSIONS[role] || [];

  if (!tenantId) {
    return defaultPerms;
  }

  try {
    const db = await getDB();
    const customPerms = db
      .prepare(
        `SELECT resource, action, allowed FROM role_permissions 
         WHERE tenantId = ? AND role = ?`
      )
      .all(tenantId, role) as Array<{
      resource: Resource;
      action: Action;
      allowed: number;
    }>;

    // Merge custom permissions with defaults
    const mergedPerms = new Map<string, Permission>();

    // Add defaults first
    for (const perm of defaultPerms) {
      const key = `${perm.resource}:${perm.action}`;
      mergedPerms.set(key, perm);
    }

    // Override with custom permissions
    for (const perm of customPerms) {
      const key = `${perm.resource}:${perm.action}`;
      mergedPerms.set(key, {
        resource: perm.resource,
        action: perm.action,
        allowed: perm.allowed === 1,
      });
    }

    return Array.from(mergedPerms.values());
  } catch (error) {
    console.error('Error getting role permissions:', error);
    return defaultPerms;
  }
}

/**
 * Set a custom permission for a role (enterprise feature)
 */
export async function setCustomPermission(
  tenantId: string,
  role: TenantUserRole,
  resource: Resource,
  action: Action,
  allowed: boolean
): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO role_permissions (id, tenantId, role, resource, action, allowed, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenantId, role, resource, action) 
     DO UPDATE SET allowed = ?, updatedAt = ?`
  ).run(
    uuidv4(),
    tenantId,
    role,
    resource,
    action,
    allowed ? 1 : 0,
    now,
    now,
    allowed ? 1 : 0,
    now
  );
}

/**
 * Remove a custom permission (revert to default)
 */
export async function removeCustomPermission(
  tenantId: string,
  role: TenantUserRole,
  resource: Resource,
  action: Action
): Promise<void> {
  const db = await getDB();
  db.prepare(
    `DELETE FROM role_permissions 
     WHERE tenantId = ? AND role = ? AND resource = ? AND action = ?`
  ).run(tenantId, role, resource, action);
}

/**
 * Log an action to the audit log
 */
export async function logAuditAction(
  tenantId: string,
  userId: string,
  action: string,
  resource: Resource,
  resourceId?: string,
  changes?: Record<string, unknown>,
  result: 'success' | 'failure' | 'denied' = 'success',
  reason?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO audit_logs 
     (id, tenantId, userId, action, resource, resourceId, changes, ipAddress, userAgent, result, reason, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    tenantId,
    userId,
    action,
    resource,
    resourceId || null,
    changes ? JSON.stringify(changes) : null,
    ipAddress || null,
    userAgent || null,
    result,
    reason || null,
    now
  );
}

/**
 * Get audit logs for a tenant
 */
export async function getAuditLogs(
  tenantId: string,
  options: {
    userId?: string;
    resource?: Resource;
    limit?: number;
    offset?: number;
  } = {}
) {
  const db = await getDB();
  const { userId, resource, limit = 100, offset = 0 } = options;

  let query = `SELECT * FROM audit_logs WHERE tenantId = ?`;
  const params: (string | number)[] = [tenantId];

  if (userId) {
    query += ` AND userId = ?`;
    params.push(userId);
  }

  if (resource) {
    query += ` AND resource = ?`;
    params.push(resource);
  }

  query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/**
 * Get audit logs across all tenants (system admin only)
 */
export async function getAllAuditLogs(
  options: {
    userId?: string;
    resource?: Resource;
    tenantId?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const db = await getDB();
  const { userId, resource, tenantId, limit = 100, offset = 0 } = options;

  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params: (string | number)[] = [];

  if (tenantId) {
    query += ` AND tenantId = ?`;
    params.push(tenantId);
  }

  if (userId) {
    query += ` AND userId = ?`;
    params.push(userId);
  }

  if (resource) {
    query += ` AND resource = ?`;
    params.push(resource);
  }

  query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/**
 * Get the role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(role: TenantUserRole): number {
  const levels: Record<TenantUserRole, number> = {
    owner: 100,
    admin: 80,
    integration_manager: 60,
    endpoint_manager: 60,
    developer: 40,
    viewer: 20,
  };
  return levels[role] || 0;
}

/**
 * Check if role A can manage role B
 */
export function canManageRole(managerRole: TenantUserRole, targetRole: TenantUserRole): boolean {
  return getRoleLevel(managerRole) > getRoleLevel(targetRole);
}
