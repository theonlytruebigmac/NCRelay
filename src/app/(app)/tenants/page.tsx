'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { PageShell } from '@/components/layout/PageShell';
import { Building2, Plus, Activity, Users, Lock, Unlock, Trash2, Search, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TenantWithRole } from '@/lib/types';
import { RoleBadge } from '@/components/tenant/RoleSelector';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Helper function to format dates
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export default function TenantsPage() {
  const { user } = useAuth();
  const { tenants, loading, refreshTenants, setCurrentTenant } = useTenant();
  const router = useRouter();
  const [allTenants, setAllTenants] = useState<TenantWithRole[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'slug' | 'plan' | 'createdAt'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

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

  // Filter and sort tenants
  const filteredAndSortedTenants = useMemo(() => {
    let filtered = allTenants.filter(tenant => 
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.domain?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: string | number = a[sortField] || '';
      let bValue: string | number = b[sortField] || '';

      if (sortField === 'createdAt') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [allTenants, searchQuery, sortField, sortDirection]);

  const handleSort = (field: 'name' | 'slug' | 'plan' | 'createdAt') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelectTenant = (tenantId: string) => {
    setSelectedTenants(prev => 
      prev.includes(tenantId) 
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTenants.length === filteredAndSortedTenants.length) {
      setSelectedTenants([]);
    } else {
      setSelectedTenants(filteredAndSortedTenants.map(t => t.id));
    }
  };

  const handleBulkPlanChange = async (newPlan: 'free' | 'pro' | 'enterprise') => {
    if (selectedTenants.length === 0) return;

    try {
      const promises = selectedTenants.map(tenantId =>
        fetch(`/api/tenants/${tenantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: newPlan }),
        })
      );

      await Promise.all(promises);

      toast({
        title: 'Plans Updated',
        description: `${selectedTenants.length} tenant(s) updated to ${newPlan} plan.`,
      });

      // Refresh and clear selection
      const updatedResponse = await fetch('/api/tenants');
      const data = await updatedResponse.json();
      setAllTenants(data.tenants || []);
      setSelectedTenants([]);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update some tenant plans.',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTenants.length === 0) return;

    try {
      const promises = selectedTenants.map(tenantId =>
        fetch(`/api/tenants/${tenantId}`, {
          method: 'DELETE',
        })
      );

      await Promise.all(promises);

      toast({
        title: 'Tenants Deleted',
        description: `${selectedTenants.length} tenant(s) permanently deleted.`,
      });

      // Refresh and clear selection
      const updatedResponse = await fetch('/api/tenants');
      const data = await updatedResponse.json();
      setAllTenants(data.tenants || []);
      setSelectedTenants([]);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete some tenants.',
      });
    } finally {
      setBulkDeleteDialogOpen(false);
    }
  };

  const handlePlanChange = async (tenantId: string, newPlan: 'free' | 'pro' | 'enterprise') => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });

      if (!response.ok) throw new Error('Failed to update plan');

      toast({
        title: 'Plan Updated',
        description: `Tenant plan changed to ${newPlan}.`,
      });

      // Refresh tenant list
      const updatedResponse = await fetch('/api/tenants');
      const data = await updatedResponse.json();
      setAllTenants(data.tenants || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update tenant plan.',
      });
    }
  };

  const handleToggleLock = async (tenantId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (!response.ok) throw new Error('Failed to update tenant');

      toast({
        title: currentEnabled ? 'Tenant Locked' : 'Tenant Unlocked',
        description: `Tenant has been ${currentEnabled ? 'locked' : 'unlocked'} successfully.`,
      });

      // Refresh tenant list
      const updatedResponse = await fetch('/api/tenants');
      const data = await updatedResponse.json();
      setAllTenants(data.tenants || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update tenant status.',
      });
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;

    try {
      const response = await fetch(`/api/tenants/${tenantToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete tenant');

      toast({
        title: 'Tenant Deleted',
        description: 'Tenant has been permanently deleted.',
      });

      // Refresh tenant list
      const updatedResponse = await fetch('/api/tenants');
      const data = await updatedResponse.json();
      setAllTenants(data.tenants || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete tenant.',
      });
    } finally {
      setDeleteDialogOpen(false);
      setTenantToDelete(null);
    }
  };

  if (loading) {
    return (
      <PageShell
        title="Tenants"
        description="Manage your organization workspaces"
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-primary/50 animate-pulse" />
            <p className="text-muted-foreground">Loading tenants...</p>
          </div>
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
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug, or domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-muted-foreground">
            Showing {filteredAndSortedTenants.length} of {allTenants.length} tenant{allTenants.length !== 1 ? 's' : ''}
          </p>
          {user?.isAdmin && selectedTenants.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedTenants.length} selected</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">Change Plan</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkPlanChange('free')}>
                    Set to Free
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPlanChange('pro')}>
                    Set to Pro
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPlanChange('enterprise')}>
                    Set to Enterprise
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                Delete Selected
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tenants Table */}
      {allTenants.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
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
      ) : filteredAndSortedTenants.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No results found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search query
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {user?.isAdmin && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedTenants.length === filteredAndSortedTenants.length && filteredAndSortedTenants.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('name')}
                    className="h-8 px-2 hover:bg-transparent"
                  >
                    Name
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('slug')}
                    className="h-8 px-2 hover:bg-transparent"
                  >
                    Slug
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('plan')}
                    className="h-8 px-2 hover:bg-transparent"
                  >
                    Plan
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTenants.map((tenant) => (
                <TableRow key={tenant.id} className="group">
                  {user?.isAdmin && (
                    <TableCell>
                      <Checkbox
                        checked={selectedTenants.includes(tenant.id)}
                        onCheckedChange={() => toggleSelectTenant(tenant.id)}
                        aria-label={`Select ${tenant.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {tenant.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">/{tenant.slug}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tenant.domain || '—'}
                  </TableCell>
                  <TableCell>
                    {user?.isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-2">
                            <Badge variant={getPlanBadgeVariant(tenant.plan)} className="cursor-pointer">
                              {tenant.plan}
                            </Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => handlePlanChange(tenant.id, 'free')}
                            disabled={tenant.plan === 'free'}
                          >
                            Free
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handlePlanChange(tenant.id, 'pro')}
                            disabled={tenant.plan === 'pro'}
                          >
                            Pro
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handlePlanChange(tenant.id, 'enterprise')}
                            disabled={tenant.plan === 'enterprise'}
                          >
                            Enterprise
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge variant={getPlanBadgeVariant(tenant.plan)}>
                        {tenant.plan}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={tenant.userRole as any || 'viewer'} />
                  </TableCell>
                  <TableCell>
                    {!!tenant.enabled ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20">
                        Locked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatDate(tenant.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setCurrentTenant(tenant);
                          router.push('/dashboard/monitor');
                        }}
                        className="h-8 w-8"
                        title="Monitor"
                      >
                        <Activity className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setCurrentTenant(tenant);
                          router.push('/dashboard/users');
                        }}
                        className="h-8 w-8"
                        title="Users"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      {user?.isAdmin && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleToggleLock(tenant.id, !!tenant.enabled)}
                            className="h-8 w-8"
                            title={!!tenant.enabled ? 'Lock' : 'Unlock'}
                          >
                            {!!tenant.enabled ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setTenantToDelete(tenant.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tenant
              and remove all associated data including users, endpoints, and integrations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTenantToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTenant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTenants.length} tenant(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedTenants.length} tenant(s)
              and remove all associated data including users, endpoints, and integrations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedTenants.length} Tenant(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
