'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant, TenantWithRole, TenantUserRole } from '@/lib/types';
import { useAuth } from './AuthContext';

interface TenantContextType {
  currentTenant: TenantWithRole | null;
  tenants: TenantWithRole[];
  loading: boolean;
  error: string | null;
  userRole: TenantUserRole | null;
  isAllTenantsView: boolean;
  setCurrentTenant: (tenant: TenantWithRole | null) => void;
  setAllTenantsView: (enabled: boolean) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<TenantWithRole | null>(null);
  const [tenants, setTenants] = useState<TenantWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAllTenantsView, setIsAllTenantsView] = useState(false);

  const fetchTenants = async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/tenants', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }

      const data = await response.json();
      setTenants(data.tenants || []);

      // Check if all tenants view was previously enabled (admin only)
      const savedAllTenantsView = localStorage.getItem('allTenantsView') === 'true';
      if (savedAllTenantsView && user.isAdmin) {
        setIsAllTenantsView(true);
        setCurrentTenant(null);
        document.cookie = 'allTenantsView=true; path=/; max-age=' + (60 * 60 * 24 * 7);
        return;
      }

      // Auto-select first tenant if none selected
      if (!currentTenant && data.tenants.length > 0) {
        const savedTenantId = localStorage.getItem('currentTenantId');
        const tenant = savedTenantId
          ? data.tenants.find((t: TenantWithRole) => t.id === savedTenantId)
          : data.tenants[0];
        const selectedTenant = tenant || data.tenants[0];
        setCurrentTenant(selectedTenant);
        setIsAllTenantsView(false);
        // Set cookie for server-side access
        document.cookie = `currentTenantId=${selectedTenant.id}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrentTenant = (tenant: TenantWithRole | null) => {
    setCurrentTenant(tenant);
    setIsAllTenantsView(false);
    if (tenant) {
      localStorage.setItem('currentTenantId', tenant.id);
      localStorage.removeItem('allTenantsView');
      // Set cookie for server-side access
      document.cookie = `currentTenantId=${tenant.id}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
      document.cookie = 'allTenantsView=; path=/; max-age=0';
    } else {
      localStorage.removeItem('currentTenantId');
      // Remove cookie
      document.cookie = 'currentTenantId=; path=/; max-age=0';
    }
  };

  const handleSetAllTenantsView = (enabled: boolean) => {
    setIsAllTenantsView(enabled);
    if (enabled) {
      setCurrentTenant(null);
      localStorage.setItem('allTenantsView', 'true');
      localStorage.removeItem('currentTenantId');
      document.cookie = 'allTenantsView=true; path=/; max-age=' + (60 * 60 * 24 * 7);
      document.cookie = 'currentTenantId=; path=/; max-age=0';
    } else {
      localStorage.removeItem('allTenantsView');
      document.cookie = 'allTenantsView=; path=/; max-age=0';
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [user]);

  const value: TenantContextType = {
    currentTenant,
    tenants,
    loading,
    error,
    userRole: currentTenant?.userRole || null,
    isAllTenantsView,
    setCurrentTenant: handleSetCurrentTenant,
    setAllTenantsView: handleSetAllTenantsView,
    refreshTenants: fetchTenants,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
