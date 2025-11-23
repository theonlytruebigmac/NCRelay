'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import type { Resource, Action } from '@/lib/types';

/**
 * Client-side hook for checking user permissions
 * Fetches permissions from API and caches them
 */
export function usePermissions() {
  const { currentTenant, userRole, isAllTenantsView } = useTenant();
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // System admins have full permissions regardless of tenant
    if (user?.isAdmin) {
      // Grant all permissions for admins
      const allPermissions: Record<string, boolean> = {};
      const resources: Resource[] = ['tenant', 'users', 'endpoints', 'integrations', 'logs', 'webhooks', 'analytics', 'billing', 'settings', 'field_filters', 'templates'];
      const actions: Action[] = ['create', 'read', 'update', 'delete', 'test', 'manage'];
      
      resources.forEach(resource => {
        actions.forEach(action => {
          allPermissions[`${resource}:${action}`] = true;
        });
      });
      
      setPermissions(allPermissions);
      setLoading(false);
      return;
    }

    if (!currentTenant || !userRole) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Fetch permissions for current role and tenant
    const fetchPermissions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tenants/${currentTenant.id}/permissions`);
        
        if (response.ok) {
          const data = await response.json();
          setPermissions(data.permissions || {});
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [currentTenant?.id, userRole, user?.isAdmin]);

  /**
   * Check if user has permission to perform an action on a resource
   */
  const can = (resource: Resource, action: Action): boolean => {
    // System admins always have permission
    if (user?.isAdmin) return true;
    
    const key = `${resource}:${action}`;
    return permissions[key] ?? false;
  };

  /**
   * Check if user is an owner
   */
  const isOwner = user?.isAdmin || userRole === 'owner';

  /**
   * Check if user is an admin
   */
  const isAdmin = user?.isAdmin || userRole === 'admin' || userRole === 'owner';

  /**
   * Check if user has management role
   */
  const isManager = 
    user?.isAdmin ||
    userRole === 'owner' || 
    userRole === 'admin' || 
    userRole === 'integration_manager' || 
    userRole === 'endpoint_manager';

  /**
   * Check if user can only view
   */
  const isViewer = !user?.isAdmin && userRole === 'viewer';

  /**
   * Role display name
   */
  const roleDisplayName = {
    owner: 'Owner',
    admin: 'Admin',
    integration_manager: 'Integration Manager',
    endpoint_manager: 'Endpoint Manager',
    developer: 'Developer',
    viewer: 'Viewer',
  }[userRole || 'viewer'];

  return {
    can,
    isOwner,
    isAdmin,
    isManager,
    isViewer,
    userRole,
    roleDisplayName,
    loading,
    permissions,
  };
}

/**
 * Higher-order component to conditionally render based on permission
 */
interface PermissionGateProps {
  resource: Resource;
  action: Action;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ resource, action, fallback = null, children }: PermissionGateProps): JSX.Element | null {
  const { can, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (!can(resource, action)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

/**
 * Hook to check a single permission
 */
export function usePermission(resource: Resource, action: Action): boolean {
  const { can } = usePermissions();
  return can(resource, action);
}
