"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, RefreshCw, Plus, Pencil, Trash2, Lock, Users as UsersIcon, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/context/TenantContext";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface Permission {
  resource: string;
  action: string;
  allowed: boolean;
}

interface Role {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  isBuiltIn: boolean;
  isActive: boolean;
  createdById: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  permissions: Permission[];
  userCount?: number;
}

const RESOURCES = [
  { key: 'tenant', label: 'Tenant Settings' },
  { key: 'users', label: 'User Management' },
  { key: 'endpoints', label: 'Endpoints' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'logs', label: 'Logs' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'billing', label: 'Billing' },
  { key: 'settings', label: 'Settings' },
  { key: 'field_filters', label: 'Field Filters' },
  { key: 'templates', label: 'Templates' },
];

const ACTIONS = [
  { key: 'create', label: 'Create' },
  { key: 'read', label: 'Read' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
  { key: 'manage', label: 'Manage' },
  { key: 'test', label: 'Test' },
];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);
  
  // Form state
  const [roleName, setRoleName] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [permissions, setPermissions] = useState<Map<string, Set<string>>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const { user: currentUser } = useAuth();
  const { can } = usePermissions();
  
  const canManageRoles = can('users', 'manage') || can('settings', 'update');

  useEffect(() => {
    loadRoles();
  }, [currentTenant?.id, currentUser?.isAdmin]);

  async function loadRoles() {
    // For system admins without a tenant, use 'system' as tenant ID to fetch built-in roles
    const tenantId = currentTenant?.id || (currentUser?.isAdmin ? 'system' : null);
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/roles`);
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load roles.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreateRole = () => {
    setRoleName("");
    setRoleSlug("");
    setRoleDescription("");
    setPermissions(new Map());
    setIsCreateDialogOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setRoleToEdit(role);
    setRoleName(role.name);
    setRoleSlug(role.slug);
    setRoleDescription(role.description || "");
    
    // Convert permissions array to Map
    const permMap = new Map<string, Set<string>>();
    role.permissions.forEach(perm => {
      if (perm.allowed) {
        if (!permMap.has(perm.resource)) {
          permMap.set(perm.resource, new Set());
        }
        permMap.get(perm.resource)!.add(perm.action);
      }
    });
    setPermissions(permMap);
    setIsEditDialogOpen(true);
  };

  const togglePermission = (resource: string, action: string) => {
    const newPermissions = new Map(permissions);
    if (!newPermissions.has(resource)) {
      newPermissions.set(resource, new Set());
    }
    const resourcePerms = newPermissions.get(resource)!;
    if (resourcePerms.has(action)) {
      resourcePerms.delete(action);
      if (resourcePerms.size === 0) {
        newPermissions.delete(resource);
      }
    } else {
      resourcePerms.add(action);
    }
    setPermissions(newPermissions);
  };

  const hasPermission = (resource: string, action: string): boolean => {
    return permissions.get(resource)?.has(action) || false;
  };

  const handleSubmitRole = async () => {
    if (!currentTenant || !roleName || !roleSlug) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields.",
      });
      return;
    }

    // Convert permissions Map to array
    const permArray: Permission[] = [];
    RESOURCES.forEach(resource => {
      ACTIONS.forEach(action => {
        permArray.push({
          resource: resource.key,
          action: action.key,
          allowed: hasPermission(resource.key, action.key),
        });
      });
    });

    setIsSubmitting(true);
    try {
      const endpoint = roleToEdit
        ? `/api/tenants/${currentTenant.id}/roles/${roleToEdit.id}`
        : `/api/tenants/${currentTenant.id}/roles`;
      
      const method = roleToEdit ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleName,
          slug: roleSlug,
          description: roleDescription,
          permissions: permArray,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save role');
      }

      toast({
        title: "Success",
        description: `Role ${roleToEdit ? 'updated' : 'created'} successfully.`,
      });

      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setRoleToEdit(null);
      await loadRoles();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save role.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!currentTenant || !roleToDelete) return;

    try {
      const response = await fetch(`/api/tenants/${currentTenant.id}/roles/${roleToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete role');
      }

      toast({
        title: "Success",
        description: "Role deleted successfully.",
      });

      setRoleToDelete(null);
      await loadRoles();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete role.",
      });
    }
  };

  // Show message for non-admin users without a tenant
  if (!currentTenant && !currentUser?.isAdmin) {
    return (
      <PageShell
        title="Role Management"
        description="Manage roles and permissions"
      >
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-16 w-16 mb-4 text-muted-foreground" />
            <h2 className="text-xl font-medium mb-2">No Tenant Selected</h2>
            <p className="text-muted-foreground text-center">
              Please select a tenant to manage roles and permissions.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Role Management"
      description={currentTenant ? `Manage roles and permissions for ${currentTenant.name}` : "View built-in system roles"}
      actions={
        <div className="flex gap-2">
          <Button onClick={loadRoles} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {canManageRoles && currentTenant && (
            <Button onClick={handleCreateRole} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          )}
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Roles ({roles.length})
          </CardTitle>
          <CardDescription>
            Configure role-based access control and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : roles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No roles found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {role.name}
                        {role.isBuiltIn && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Built-in
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {role.description || 'No description'}
                    </TableCell>
                    <TableCell>
                      {role.isBuiltIn ? (
                        <Badge variant="outline">System</Badge>
                      ) : (
                        <Badge variant="default">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {role.isActive ? (
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {role.permissions.filter(p => p.allowed).length} permissions
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageRoles && (
                        <div className="flex items-center justify-end gap-2">
                          {!role.isBuiltIn && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRole(role)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRoleToDelete(role)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {role.isBuiltIn && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(role)}
                              disabled
                            >
                              <Lock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Role Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open && !roleToEdit);
        setIsEditDialogOpen(open && !!roleToEdit);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{roleToEdit ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            <DialogDescription>
              {roleToEdit ? 'Update role details and permissions' : 'Create a custom role with specific permissions'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="roleName">Role Name *</Label>
                <Input
                  id="roleName"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g., Content Manager"
                  disabled={roleToEdit?.isBuiltIn}
                />
              </div>
              <div>
                <Label htmlFor="roleSlug">Role Slug *</Label>
                <Input
                  id="roleSlug"
                  value={roleSlug}
                  onChange={(e) => setRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="e.g., content_manager"
                  disabled={roleToEdit?.isBuiltIn}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Describe what this role can do..."
                disabled={roleToEdit?.isBuiltIn}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Permissions</h3>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Resource</TableHead>
                      {ACTIONS.map(action => (
                        <TableHead key={action.key} className="text-center">
                          {action.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RESOURCES.map(resource => (
                      <TableRow key={resource.key}>
                        <TableCell className="font-medium">{resource.label}</TableCell>
                        {ACTIONS.map(action => (
                          <TableCell key={action.key} className="text-center">
                            <Checkbox
                              checked={hasPermission(resource.key, action.key)}
                              onCheckedChange={() => togglePermission(resource.key, action.key)}
                              disabled={roleToEdit?.isBuiltIn}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setIsEditDialogOpen(false);
              setRoleToEdit(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRole} disabled={isSubmitting || roleToEdit?.isBuiltIn}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {roleToEdit ? 'Update Role' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the role "{roleToDelete?.name}". 
              {roleToDelete?.userCount && roleToDelete.userCount > 0 ? (
                <span className="text-destructive font-medium">
                  {' '}Warning: {roleToDelete.userCount} user(s) currently have this role.
                </span>
              ) : (
                ' This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
