"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, Mail, Shield, Loader2, RefreshCw, Plus, UserPlus, Trash2, Building2, Search, Pencil, KeyRound, ShieldCheck, ShieldX, ShieldAlert, AlertTriangle, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/context/TenantContext";
import { useAuth } from "@/context/AuthContext";
import { RoleBadge, RoleSelector } from "@/components/tenant/RoleSelector";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  isAdmin?: boolean;
  createdAt: string;
}

interface GlobalUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  tenantCount: number;
  createdAt: string;
}

export default function UsersPage() {
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [globalUsers, setGlobalUsers] = useState<GlobalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [user2FAStatus, setUser2FAStatus] = useState<Record<string, { isEnabled: boolean; enforcedByAdmin: boolean }>>({});
  const [lockedAccounts, setLockedAccounts] = useState<any[]>([]);
  
  // Dialogs
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToRemove, setUserToRemove] = useState<TenantUser | null>(null);
  const [userToEdit, setUserToEdit] = useState<GlobalUser | null>(null);
  
  // Form state
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserName, setAddUserName] = useState("");
  const [addUserPassword, setAddUserPassword] = useState("");
  const [addUserRole, setAddUserRole] = useState<string>("viewer");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserIsAdmin, setEditUserIsAdmin] = useState(false);
  const [editUserRoles, setEditUserRoles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Roles state
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [userTenantRoles, setUserTenantRoles] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const { currentTenant, isAllTenantsView } = useTenant();
  const { user: currentUser } = useAuth();
  const { can } = usePermissions();
  
  const canManageUsers = can('users', 'manage');
  const canCreateUsers = can('users', 'create');

  useEffect(() => {
    loadUsers();
    if (currentTenant) {
      loadRoles();
    }
  }, [currentTenant?.id, isAllTenantsView]);

  async function loadUsers() {
    setIsLoading(true);
    try {
      if (currentUser?.isAdmin && isAllTenantsView) {
        // Load all users for system admin
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const data = await response.json();
          const users = data.users || [];
          setGlobalUsers(users);
          
          // Load 2FA status for all users
          if (canManageUsers) {
            users.forEach((user: GlobalUser) => {
              fetch2FAStatus(user.id);
            });
            // Load locked accounts
            fetchLockedAccounts();
          }
        }
      } else if (currentTenant) {
        // Load tenant users
        const response = await fetch(`/api/tenants/${currentTenant.id}/users`);
        if (response.ok) {
          const data = await response.json();
          const users = data.users || [];
          setTenantUsers(users);
          
          // Load 2FA status for tenant users
          if (canManageUsers) {
            users.forEach((user: TenantUser) => {
              fetch2FAStatus(user.userId);
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to load users:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRoles() {
    if (!currentTenant) return;
    
    try {
      const response = await fetch(`/api/tenants/${currentTenant.id}/roles`);
      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data.roles || []);
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  }

  const handleAddUserToTenant = async () => {
    if (!currentTenant || !addUserEmail) return;

    setIsSubmitting(true);
    try {
      // Check if the selected role is a built-in role or custom role
      const builtInRoles = ['owner', 'admin', 'integration_manager', 'endpoint_manager', 'developer', 'viewer'];
      const isBuiltInRole = builtInRoles.includes(addUserRole);
      
      // Find the role in availableRoles to get its ID if it's custom
      const selectedRole = availableRoles.find(r => r.slug === addUserRole || r.id === addUserRole);
      
      const rolePayload: any = {
        email: addUserEmail,
        name: addUserName || addUserEmail.split('@')[0],
        password: addUserPassword
      };
      
      if (selectedRole && !selectedRole.isBuiltIn) {
        rolePayload.customRoleId = selectedRole.id;
      } else {
        rolePayload.role = addUserRole;
      }

      const response = await fetch(`/api/tenants/${currentTenant.id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rolePayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add user');
      }

      toast({
        title: "Success",
        description: "User added to tenant successfully.",
      });

      setIsAddUserDialogOpen(false);
      setAddUserEmail("");
      setAddUserName("");
      setAddUserPassword("");
      setAddUserRole("viewer");
      await loadUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add user to tenant.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          isAdmin: newUserIsAdmin
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      toast({
        title: "Success",
        description: "User created successfully.",
      });

      setIsCreateUserDialogOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserIsAdmin(false);
      await loadUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create user.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!currentTenant) return;

    try {
      const response = await fetch(`/api/tenants/${currentTenant.id}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user role');
      }

      toast({
        title: "Success",
        description: "User role updated successfully.",
      });

      await loadUsers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user role.",
      });
    }
  };

  const handleSendPasswordReset = async (userEmail: string, userName: string) => {
    try {
      const response = await fetch('/api/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      if (response.ok) {
        toast({
          title: "Password Reset Sent",
          description: `Password reset email sent to ${userName}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to send password reset email",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send password reset email",
      });
    }
  };

  const fetch2FAStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/2fa`);
      if (response.ok) {
        const data = await response.json();
        setUser2FAStatus(prev => ({ ...prev, [userId]: data }));
      }
    } catch (error) {
      console.error('Failed to fetch 2FA status:', error);
    }
  };

  const handleReset2FA = async (userId: string, userName: string) => {
    if (!confirm(`Reset 2FA for ${userName}? They will need to set it up again.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/2fa`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "2FA Reset",
          description: `2FA has been reset for ${userName}`,
        });
        await fetch2FAStatus(userId);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to reset 2FA",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset 2FA",
      });
    }
  };

  const fetchLockedAccounts = async () => {
    if (!canManageUsers) return;
    
    try {
      const response = await fetch('/api/admin/lockouts');
      if (response.ok) {
        const data = await response.json();
        setLockedAccounts(data.lockedAccounts || []);
      }
    } catch (error) {
      console.error('Failed to fetch locked accounts:', error);
    }
  };

  const handleUnlockAccount = async (userId: string, userName: string) => {
    if (!confirm(`Unlock account for ${userName}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/lockouts/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        toast({
          title: "Account Unlocked",
          description: `${userName} can now log in`,
        });
        await fetchLockedAccounts();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to unlock account",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unlock account",
      });
    }
  };

  const handleToggle2FAEnforcement = async (userId: string, userName: string, enforce: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enforce }),
      });

      if (response.ok) {
        toast({
          title: enforce ? "2FA Enforced" : "2FA Enforcement Removed",
          description: enforce 
            ? `${userName} must now enable 2FA` 
            : `2FA is now optional for ${userName}`,
        });
        await fetch2FAStatus(userId);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update 2FA enforcement",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update 2FA enforcement",
      });
    }
  };

  const handleRemoveUserFromTenant = async () => {
    if (!currentTenant || !userToRemove) return;

    try {
      const response = await fetch(`/api/tenants/${currentTenant.id}/users/${userToRemove.userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove user');
      }

      toast({
        title: "Success",
        description: "User removed from tenant successfully.",
      });

      setUserToRemove(null);
      await loadUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove user from tenant.",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(`/api/admin/users/${userToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      toast({
        title: "Success",
        description: "User deleted successfully.",
      });

      setUserToDelete(null);
      await loadUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user.",
      });
    }
  };

  const handleEditUser = async (user: GlobalUser) => {
    setUserToEdit(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserPassword("");
    setEditUserIsAdmin(user.isAdmin);
    
    // Load user's tenant roles
    try {
      if (currentUser?.isAdmin) {
        // System admin: Load all tenant roles
        const response = await fetch(`/api/admin/users/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          const roles: Record<string, string> = {};
          data.tenants?.forEach((t: any) => {
            roles[t.id] = t.role;
          });
          setUserTenantRoles(roles);
        }
      } else if (currentTenant) {
        // Tenant view: Load role for current tenant
        const response = await fetch(`/api/tenants/${currentTenant.id}/users/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setUserTenantRoles({ [currentTenant.id]: data.role || '' });
        }
      }
    } catch (error) {
      console.error('Failed to load user roles:', error);
    }
    
    setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!userToEdit || !editUserName || !editUserEmail) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Name and email are required.",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editUserEmail)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid email address.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: any = {
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        isAdmin: editUserIsAdmin,
      };

      // Only include password if it's been changed
      if (editUserPassword && editUserPassword.trim()) {
        updateData.password = editUserPassword;
      }

      const response = await fetch(`/api/admin/users/${userToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      // Update roles for all tenants (in global view) or current tenant
      // Only if user has tenant memberships and we're in a tenant context
      const hasValidTenantRoles = Object.entries(userTenantRoles).some(([_, role]) => role && role.trim() !== '');
      
      if (hasValidTenantRoles && (currentTenant || Object.keys(userTenantRoles).length > 0)) {
        const tenantsToUpdate = currentTenant 
          ? [{ id: currentTenant.id, role: userTenantRoles[currentTenant.id] }]
          : Object.entries(userTenantRoles).map(([id, role]) => ({ id, role }));

        for (const { id: tenantId, role: roleSlugOrId } of tenantsToUpdate) {
          // Skip if no role selected or role is empty/undefined
          if (!roleSlugOrId || roleSlugOrId.trim() === '') continue;
          
          try {
            // Check if this is a built-in role or custom role
            const builtInRoles = ['owner', 'admin', 'integration_manager', 'endpoint_manager', 'developer', 'viewer'];
            const isBuiltInRole = builtInRoles.includes(roleSlugOrId);
            
            // Find the role in availableRoles to get its ID if it's custom
            const selectedRole = availableRoles.find(r => r.slug === roleSlugOrId || r.id === roleSlugOrId);
            
            const rolePayload = selectedRole && !selectedRole.isBuiltIn
              ? { customRoleId: selectedRole.id }
              : { role: roleSlugOrId };

            const roleResponse = await fetch(
              `/api/tenants/${tenantId}/users/${userToEdit.id}`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rolePayload),
              }
            );

            if (!roleResponse.ok) {
              console.error(`Failed to update user role in tenant ${tenantId}`);
            }
          } catch (roleError) {
            console.error(`Error updating tenant role for ${tenantId}:`, roleError);
          }
        }
      }

      toast({
        title: "Success",
        description: "User updated successfully.",
      });

      setIsEditUserDialogOpen(false);
      setUserToEdit(null);
      setEditUserName("");
      setEditUserEmail("");
      setEditUserPassword("");
      setEditUserIsAdmin(false);
      setUserTenantRoles({});
      await loadUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGlobalUsers = globalUsers.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTenantUsers = tenantUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!currentUser) {
    return null;
  }

  // System Admin View - All Tenants
  if (currentUser.isAdmin && isAllTenantsView) {
    return (
      <PageShell
        title="Global User Management"
        description="Manage all users across the system"
        actions={
          <div className="flex gap-2">
            <Button onClick={loadUsers} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setIsCreateUserDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </div>
        }
      >
        {lockedAccounts.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Locked Accounts ({lockedAccounts.length})</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-2">
                {lockedAccounts.map((account) => {
                  const minutesRemaining = Math.ceil(
                    (new Date(account.unlockAt).getTime() - Date.now()) / (1000 * 60)
                  );
                  return (
                    <div
                      key={account.userId}
                      className="flex items-center justify-between p-2 bg-background rounded border"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{account.userName}</div>
                        <div className="text-sm text-muted-foreground">
                          {account.userEmail} • Unlocks in {minutesRemaining} minutes
                        </div>
                      </div>
                      <Button
                        onClick={() => handleUnlockAccount(account.userId, account.userName)}
                        variant="outline"
                        size="sm"
                      >
                        <Unlock className="mr-2 h-4 w-4" />
                        Unlock
                      </Button>
                    </div>
                  );
                })}
              </div>
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All System Users ({globalUsers.length})
            </CardTitle>
            <CardDescription>
              System-wide user management for administrators
            </CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredGlobalUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No users found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGlobalUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.name}
                          {user.isAdmin && (
                            <Badge variant="secondary" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              System Admin
                            </Badge>
                          )}
                          {user2FAStatus[user.id]?.isEnabled && (
                            <Badge variant="outline" className="text-xs">
                              <ShieldCheck className="h-3 w-3 mr-1 text-green-600" />
                              2FA
                            </Badge>
                          )}
                          {user2FAStatus[user.id]?.enforcedByAdmin && !user2FAStatus[user.id]?.isEnabled && (
                            <Badge variant="destructive" className="text-xs">
                              <ShieldAlert className="h-3 w-3 mr-1" />
                              2FA Required
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge variant="default">Global Admin</Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Building2 className="h-3 w-3 mr-1" />
                          {user.tenantCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendPasswordReset(user.email, user.name);
                            }}
                            aria-label="Send password reset"
                            title="Send password reset email"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          
                          {canManageUsers && user2FAStatus[user.id]?.isEnabled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReset2FA(user.id, user.name);
                              }}
                              aria-label="Reset 2FA"
                              title="Reset 2FA"
                            >
                              <ShieldX className="h-4 w-4 text-orange-600" />
                            </Button>
                          )}
                          
                          {canManageUsers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggle2FAEnforcement(
                                  user.id, 
                                  user.name, 
                                  !user2FAStatus[user.id]?.enforcedByAdmin
                                );
                              }}
                              aria-label={user2FAStatus[user.id]?.enforcedByAdmin ? "Remove 2FA requirement" : "Require 2FA"}
                              title={user2FAStatus[user.id]?.enforcedByAdmin ? "Remove 2FA requirement" : "Require 2FA"}
                            >
                              {user2FAStatus[user.id]?.enforcedByAdmin ? (
                                <ShieldCheck className="h-4 w-4 text-green-600" />
                              ) : (
                                <Shield className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditUser(user);
                            }}
                            aria-label="Edit user"
                            title="Edit user"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user.id !== currentUser.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserToDelete(user.id);
                              }}
                              aria-label="Delete user"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and permissions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editName">Name *</Label>
                <Input
                  id="editName"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="editEmail">Email *</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="editPassword">New Password (optional)</Label>
                <Input
                  id="editPassword"
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsAdmin"
                  checked={editUserIsAdmin}
                  onChange={(e) => setEditUserIsAdmin(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="editIsAdmin" className="cursor-pointer">
                  System Administrator
                </Label>
              </div>
              
              {/* Role Assignment Section */}
              {!editUserIsAdmin && (
                <div className="border-t pt-4 mt-4">
                  {isAllTenantsView ? (
                    /* Global view: Show tenant memberships with editable role selectors */
                    <div>
                      <Label className="mb-3 block">Tenant Memberships & Roles</Label>
                      {Object.keys(userTenantRoles).length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                          {Object.entries(userTenantRoles).map(([tenantId, roleSlug]) => (
                            <div key={tenantId} className="p-3 bg-muted/30 rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Tenant ID: {tenantId.substring(0, 13)}...
                                </span>
                              </div>
                              <Select 
                                value={roleSlug || ""} 
                                onValueChange={(value) => {
                                  setUserTenantRoles(prev => ({
                                    ...prev,
                                    [tenantId]: value
                                  }));
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="owner">Owner</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="integration_manager">Integration Manager</SelectItem>
                                  <SelectItem value="endpoint_manager">Endpoint Manager</SelectItem>
                                  <SelectItem value="developer">Developer</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          This user is not a member of any tenants yet.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-3">
                        Select a role for each tenant. Custom roles are only available in tenant-specific view.
                      </p>
                    </div>
                  ) : currentTenant ? (
                    /* Tenant view: Allow role selection for current tenant with all available roles */
                    <div>
                      <Label className="mb-3 block">Role in {currentTenant.name}</Label>
                      <div className="space-y-2">
                        <Select 
                          value={userTenantRoles[currentTenant.id] || ""} 
                          onValueChange={(value) => {
                            setUserTenantRoles(prev => ({
                              ...prev,
                              [currentTenant.id]: value
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role for this tenant" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.length > 0 ? (
                              availableRoles.map((role) => (
                                <SelectItem key={role.id} value={role.slug}>
                                  {role.name}
                                  {role.description && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      - {role.description.substring(0, 40)}...
                                    </span>
                                  )}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="integration_manager">Integration Manager</SelectItem>
                                <SelectItem value="endpoint_manager">Endpoint Manager</SelectItem>
                                <SelectItem value="developer">Developer</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Assign a role for this user in {currentTenant.name}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Select a tenant to manage roles.
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account in the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={newUserIsAdmin}
                  onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="isAdmin" className="cursor-pointer">
                  System Administrator
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this user and remove them from all tenants. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageShell>
    );
  }

  if (!currentTenant) {
    return (
      <PageShell
        title="Users Management"
        description="Manage users in your tenant"
      >
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 mb-4 text-muted-foreground" />
            <h2 className="text-xl font-medium mb-2">No Tenant Selected</h2>
            <p className="text-muted-foreground text-center">
              Please select a tenant to view and manage users.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Tenant User Management"
      description={`Manage users in ${currentTenant.name}`}
      actions={
        <div className="flex gap-2">
          <Button onClick={loadUsers} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {canCreateUsers && (
            <Button onClick={() => setIsAddUserDialogOpen(true)} size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          )}
        </div>
      }
    >
      {lockedAccounts.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Locked Accounts ({lockedAccounts.length})</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {lockedAccounts.map((account) => {
                const minutesRemaining = Math.ceil(
                  (new Date(account.unlockAt).getTime() - Date.now()) / (1000 * 60)
                );
                return (
                  <div
                    key={account.userId}
                    className="flex items-center justify-between p-2 bg-background rounded border"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{account.userName}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.userEmail} • Unlocks in {minutesRemaining} minutes
                      </div>
                    </div>
                    <Button
                      onClick={() => handleUnlockAccount(account.userId, account.userName)}
                      variant="outline"
                      size="sm"
                    >
                      <Unlock className="mr-2 h-4 w-4" />
                      Unlock
                    </Button>
                  </div>
                );
              })}
            </div>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tenant Users ({tenantUsers.length})
          </CardTitle>
          <CardDescription>
            Manage user roles and permissions for this tenant
          </CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTenantUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? "No users found matching your search" : "No users in this tenant yet"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Added</TableHead>
                  {canManageUsers && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenantUsers.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.name || 'Unknown User'}
                        {user.isAdmin && (
                          <Badge variant="secondary" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            System Admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManageUsers && !user.isAdmin && user.role !== 'owner' ? (
                        <RoleSelector
                          currentRole={user.role as any}
                          userId={user.userId}
                          tenantId={currentTenant.id}
                          onRoleChange={(newRole) => handleRoleChange(user.userId, newRole)}
                          canChange={true}
                        />
                      ) : (
                        <RoleBadge role={user.role as any} />
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge variant="outline" className="text-xs">Global</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Tenant</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canManageUsers && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendPasswordReset(user.email, user.name);
                            }}
                            aria-label="Send password reset"
                            title="Send password reset email"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {!user.isAdmin && user.role !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserToRemove(user);
                              }}
                              aria-label="Remove user"
                              title="Remove from tenant"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add User to Tenant Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User to Tenant</DialogTitle>
            <DialogDescription>
              Create a new user or add an existing user to this tenant. If the user doesn't exist, they will be created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="userEmail">Email *</Label>
              <Input
                id="userEmail"
                type="email"
                value={addUserEmail}
                onChange={(e) => setAddUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="userName">Name (optional)</Label>
              <Input
                id="userName"
                type="text"
                value={addUserName}
                onChange={(e) => setAddUserName(e.target.value)}
                placeholder="John Doe (defaults to email prefix)"
              />
            </div>
            <div>
              <Label htmlFor="userPassword">Password (optional)</Label>
              <Input
                id="userPassword"
                type="password"
                value={addUserPassword}
                onChange={(e) => setAddUserPassword(e.target.value)}
                placeholder="Leave blank for auto-generated password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                If left blank, a temporary password will be generated
              </p>
            </div>
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={addUserRole} onValueChange={setAddUserRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.length > 0 ? (
                    availableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.slug}>
                        {role.name}
                        {role.description && (
                          <span className="text-xs text-muted-foreground ml-2">
                            - {role.description.substring(0, 40)}...
                          </span>
                        )}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="endpoint_manager">Endpoint Manager</SelectItem>
                      <SelectItem value="integration_manager">Integration Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUserToTenant} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User from Tenant Dialog */}
      <AlertDialog open={!!userToRemove} onOpenChange={() => setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User from Tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {userToRemove?.name || 'this user'} from {currentTenant.name}. 
              They will lose access to all resources in this tenant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUserFromTenant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
