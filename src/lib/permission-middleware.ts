import { cookies } from 'next/headers';
import { getCurrentUser } from './auth';
import { getUserRoleInTenant } from './db';
import { checkPermission, logAuditAction } from './rbac';
import type { Resource, Action, TenantUserRole } from './types';

/**
 * Get current tenant ID from cookie (async version)
 */
async function getCurrentTenantIdAsync(): Promise<string | null> {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get('currentTenantId')?.value;
  return tenantId || null;
}

/**
 * Get current tenant ID from cookie (for use in server actions - deprecated pattern)
 * This is a workaround since we can't await cookies() in some contexts
 * @deprecated Use getCurrentTenantIdAsync or pass tenantId explicitly
 */
export function getCurrentTenantId(): string | null {
  // This function is kept for backward compatibility but will need refactoring
  // For now, it returns null and forces explicit tenantId passing
  return null;
}

/**
 * Check if the current user has permission to perform an action
 * Used in server actions and API routes
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
  options: {
    tenantId?: string;
    logAction?: boolean;
    resourceId?: string;
  } = {}
): Promise<{
  allowed: boolean;
  user: { id: string; email: string; name?: string; isAdmin?: boolean } | null;
  role: TenantUserRole | null;
  tenantId: string | null;
  reason?: string;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      allowed: false,
      user: null,
      role: null,
      tenantId: null,
      reason: 'Not authenticated',
    };
  }

  // System admins have full access
  if (user.isAdmin) {
    // Try to get tenant ID for logging purposes
    const adminTenantId = options.tenantId || await getCurrentTenantIdAsync();
    
    if (options.logAction && adminTenantId) {
      await logAuditAction(
        adminTenantId,
        user.id,
        action,
        resource,
        options.resourceId,
        undefined,
        'success',
        undefined
      );
    }
    return {
      allowed: true,
      user,
      role: 'owner', // Treat admin as owner for permission purposes
      tenantId: adminTenantId,
    };
  }

  // Get tenant ID from options or cookie
  const tenantId = options.tenantId || await getCurrentTenantIdAsync();

  if (!tenantId) {
    return {
      allowed: false,
      user,
      role: null,
      tenantId: null,
      reason: 'No tenant context available',
    };
  }

  // Get user's role in this tenant
  const role = await getUserRoleInTenant(tenantId, user.id);

  if (!role) {
    if (options.logAction) {
      await logAuditAction(
        tenantId,
        user.id,
        action,
        resource,
        options.resourceId,
        undefined,
        'denied',
        'User not a member of tenant'
      );
    }
    return {
      allowed: false,
      user,
      role: null,
      tenantId,
      reason: 'User is not a member of this tenant',
    };
  }

  // Check permission
  const permissionCheck = await checkPermission(role, resource, action, tenantId);

  // Log the action if requested
  if (options.logAction) {
    await logAuditAction(
      tenantId,
      user.id,
      action,
      resource,
      options.resourceId,
      undefined,
      permissionCheck.allowed ? 'success' : 'denied',
      permissionCheck.reason
    );
  }

  return {
    allowed: permissionCheck.allowed,
    user,
    role,
    tenantId,
    reason: permissionCheck.reason,
  };
}

/**
 * Shorthand for checking if user has permission (throws error if not)
 */
export async function ensurePermission(
  resource: Resource,
  action: Action,
  options?: {
    tenantId?: string;
    logAction?: boolean;
    resourceId?: string;
  }
): Promise<{
  user: { id: string; email: string; name?: string; isAdmin?: boolean };
  role: TenantUserRole;
  tenantId: string;
}> {
  const result = await requirePermission(resource, action, options);

  if (!result.allowed || !result.user || !result.role || !result.tenantId) {
    throw new Error(result.reason || 'Permission denied');
  }

  return {
    user: result.user,
    role: result.role,
    tenantId: result.tenantId,
  };
}

/**
 * Check if user can manage another user (must have higher role)
 */
export async function canManageUser(
  managerUserId: string,
  targetUserId: string,
  tenantId: string
): Promise<boolean> {
  const managerRole = await getUserRoleInTenant(tenantId, managerUserId);
  const targetRole = await getUserRoleInTenant(tenantId, targetUserId);

  if (!managerRole || !targetRole) {
    return false;
  }

  const roleHierarchy: Record<TenantUserRole, number> = {
    owner: 100,
    admin: 80,
    integration_manager: 60,
    endpoint_manager: 60,
    developer: 40,
    viewer: 20,
  };

  return roleHierarchy[managerRole] > roleHierarchy[targetRole];
}

/**
 * Get user's role in current tenant
 */
export async function getCurrentUserRole(): Promise<TenantUserRole | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.isAdmin) return 'owner';

  const tenantId = await getCurrentTenantIdAsync();
  if (!tenantId) return null;

  return await getUserRoleInTenant(tenantId, user.id);
}

/**
 * Check multiple permissions at once
 */
export async function checkMultiplePermissions(
  permissions: Array<{ resource: Resource; action: Action }>,
  tenantId?: string
): Promise<Record<string, boolean>> {
  const user = await getCurrentUser();
  if (!user) {
    return Object.fromEntries(
      permissions.map((p) => [`${p.resource}:${p.action}`, false])
    );
  }

  if (user.isAdmin) {
    return Object.fromEntries(
      permissions.map((p) => [`${p.resource}:${p.action}`, true])
    );
  }

  const tid = tenantId || await getCurrentTenantIdAsync();
  if (!tid) {
    return Object.fromEntries(
      permissions.map((p) => [`${p.resource}:${p.action}`, false])
    );
  }

  const role = await getUserRoleInTenant(tid, user.id);
  if (!role) {
    return Object.fromEntries(
      permissions.map((p) => [`${p.resource}:${p.action}`, false])
    );
  }

  const results: Record<string, boolean> = {};
  for (const perm of permissions) {
    const check = await checkPermission(role, perm.resource, perm.action, tid);
    results[`${perm.resource}:${perm.action}`] = check.allowed;
  }

  return results;
}
