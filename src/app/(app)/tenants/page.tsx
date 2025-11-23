'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/layout/PageShell';
import { Building2, Plus, Settings, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TenantWithRole } from '@/lib/types';
import { RoleBadge } from '@/components/tenant/RoleSelector';

export default function TenantsPage() {
  const { user } = useAuth();
  const { tenants, loading, refreshTenants } = useTenant();
  const router = useRouter();
  const [allTenants, setAllTenants] = useState<TenantWithRole[]>([]);

  useEffect(() => {
    // Refresh tenants when page loads
    refreshTenants();
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      // Admins can see all tenants via API
      fetch('/api/tenants')
        .then((res) => res.json())
        .then((data) => setAllTenants(data.tenants || []))
        .catch(console.error);
    } else {
      setAllTenants(tenants);
    }
  }, [user, tenants]);

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'default';
      case 'pro':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <PageShell
        title="Tenants"
        description="Manage your organization workspaces"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-lg animate-pulse">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Tenants"
      description="Manage your organization workspaces"
      actions={
        user?.isAdmin ? (
          <Button onClick={() => router.push('/tenants/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Tenant
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allTenants.map((tenant) => (
          <Card key={tenant.id} className="shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-xl">
                  <Building2 className="mr-2 h-6 w-6 text-primary" />
                  {tenant.name}
                </CardTitle>
                <RoleBadge role={tenant.userRole as any || 'viewer'} />
              </div>
              <CardDescription>/{tenant.slug} · {tenant.plan}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenant.domain && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Domain</h4>
                  <p className="text-sm text-foreground">{tenant.domain}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => router.push(`/tenants/${tenant.id}`)}
                  className="flex-1 gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button
                  onClick={() => router.push(`/tenants/${tenant.id}/users`)}
                  className="flex-1 gap-2"
                >
                  <Users className="h-4 w-4" />
                  Users
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {allTenants.length === 0 && (
        <Card className="shadow-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-primary/50" />
              <h3 className="text-lg font-semibold mb-2">No tenants yet</h3>
              <p className="text-muted-foreground mb-4">
                {user?.isAdmin
                  ? 'Create your first tenant to get started'
                  : "You haven't been added to any tenants yet"}
              </p>
              {user?.isAdmin && (
                <Button onClick={() => router.push('/tenants/new')} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Tenant
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
