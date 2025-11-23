'use client';

import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Plus, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';

export function TenantSwitcher() {
  const { currentTenant, tenants, setCurrentTenant, loading, isAllTenantsView, setAllTenantsView } = useTenant();
  const { user } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2">
        <Building2 className="h-4 w-4 text-sidebar-foreground/60 animate-pulse" />
        <span className="text-sm text-sidebar-foreground/60">Loading...</span>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/tenants/new')}
          className="gap-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground border-sidebar-border"
        >
          <Plus className="h-4 w-4" />
          Create Tenant
        </Button>
      </div>
    );
  }

  const isAdmin = user?.isAdmin || false;

  return (
    <div className="w-full">
      <Select
        value={isAllTenantsView ? '__all_tenants__' : (currentTenant?.id || '')}
        onValueChange={(value) => {
          if (value === '__all_tenants__') {
            setAllTenantsView(true);
            // Force a full page reload to refresh all data with new context
            window.location.reload();
          } else {
            const tenant = tenants.find((t) => t.id === value);
            setCurrentTenant(tenant || null);
            // Force a full page reload to refresh all data with new tenant context
            window.location.reload();
          }
        }}
      >
        <SelectTrigger className="w-full h-auto py-2.5 px-3 bg-sidebar-accent text-sidebar-accent-foreground border-0 hover:bg-sidebar-accent/90 transition-colors rounded-lg">
          <div className="flex items-center gap-2 text-left">
            {isAllTenantsView ? (
              <Globe className="h-4 w-4 shrink-0" />
            ) : (
              <Building2 className="h-4 w-4 shrink-0" />
            )}
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="font-medium truncate w-full">
                {isAllTenantsView ? 'All Tenants' : (currentTenant?.name || 'Select tenant')}
              </span>
              {isAllTenantsView ? (
                <span className="text-xs opacity-75">System Admin View</span>
              ) : currentTenant ? (
                <span className="text-xs opacity-75">{currentTenant.plan}</span>
              ) : null}
            </div>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-popover min-w-[200px]">
          {isAdmin && (
            <>
              <SelectItem 
                value="__all_tenants__"
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2 py-1">
                  <Globe className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">All Tenants</span>
                    <span className="text-xs text-muted-foreground">
                      System-wide access
                    </span>
                  </div>
                </div>
              </SelectItem>
              <Separator className="my-1" />
            </>
          )}
          {tenants.map((tenant) => (
            <SelectItem 
              key={tenant.id} 
              value={tenant.id}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 py-1">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{tenant.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tenant.userRole} · {tenant.plan}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
