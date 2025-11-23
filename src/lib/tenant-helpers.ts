import { NextRequest } from 'next/server';
import { getUserRoleInTenant } from './db';

/**
 * Extract tenant ID from request
 * Priority: 
 * 1. Query parameter (?tenantId=...)
 * 2. Header (x-tenant-id)
 * 3. Subdomain (tenant.example.com)
 */
export function extractTenantId(request: NextRequest): string | null {
  // Check query parameter
  const searchParams = request.nextUrl.searchParams;
  const queryTenantId = searchParams.get('tenantId');
  if (queryTenantId) {
    return queryTenantId;
  }

  // Check header
  const headerTenantId = request.headers.get('x-tenant-id');
  if (headerTenantId) {
    return headerTenantId;
  }

  // Check subdomain
  const hostname = request.headers.get('host') || '';
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    // Extract subdomain (e.g., "tenant" from "tenant.example.com")
    const subdomain = parts[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      return subdomain;
    }
  }

  return null;
}

/**
 * Verify user has access to tenant with minimum role
 */
export async function verifyTenantAccess(
  userId: string,
  tenantId: string,
  minimumRole?: 'viewer' | 'developer' | 'endpoint_manager' | 'integration_manager' | 'admin' | 'owner'
): Promise<boolean> {
  const userRole = await getUserRoleInTenant(tenantId, userId);
  
  if (!userRole) {
    return false;
  }

  if (!minimumRole) {
    return true;
  }

  const roleHierarchy = {
    viewer: 10,
    developer: 20,
    endpoint_manager: 40,
    integration_manager: 40,
    admin: 60,
    owner: 80,
  };

  return roleHierarchy[userRole] >= roleHierarchy[minimumRole];
}

/**
 * Add tenant filtering to SQL WHERE clause
 * Example: addTenantFilter('api_endpoints', 'abc-123') => "api_endpoints.tenantId = 'abc-123'"
 */
export function addTenantFilter(tableName: string, tenantId: string): string {
  return `${tableName}.tenantId = '${tenantId.replace(/'/g, "''")}'`;
}

/**
 * Get tenant context object for API responses
 */
export function getTenantContext(tenantId: string | null) {
  return {
    tenantId,
    isTenantScoped: !!tenantId,
  };
}
