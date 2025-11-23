'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TenantUserRole } from '@/lib/types';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Shield, Eye, Code } from 'lucide-react';

interface RoleSelectorProps {
  currentRole: TenantUserRole;
  userId: string;
  tenantId: string;
  onRoleChange?: (newRole: TenantUserRole) => void;
  disabled?: boolean;
  canChange: boolean;
}

const roleInfo: Record<TenantUserRole, { label: string; description: string; icon: React.ReactNode }> = {
  owner: {
    label: 'Owner',
    description: 'Full access to everything including billing and tenant deletion',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  admin: {
    label: 'Admin',
    description: 'Manage users, endpoints, integrations, and settings (except billing)',
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  billing_admin: {
    label: 'Billing Admin',
    description: 'Manage billing and payments, view resources (read-only)',
    icon: <Shield className="h-4 w-4" />,
  },
  integration_manager: {
    label: 'Integration Manager',
    description: 'Create and manage integrations, field filters, and templates',
    icon: <Shield className="h-4 w-4" />,
  },
  endpoint_manager: {
    label: 'Endpoint Manager',
    description: 'Create and manage API endpoints',
    icon: <Shield className="h-4 w-4" />,
  },
  developer: {
    label: 'Developer',
    description: 'Test webhooks and view logs, endpoints, and integrations',
    icon: <Code className="h-4 w-4" />,
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to most resources',
    icon: <Eye className="h-4 w-4" />,
  },
};

export function RoleSelector({
  currentRole,
  userId,
  tenantId,
  onRoleChange,
  disabled = false,
  canChange,
}: RoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<TenantUserRole>(currentRole);
  const [updating, setUpdating] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    const role = newRole as TenantUserRole;
    setSelectedRole(role);

    if (role === currentRole) return;

    try {
      setUpdating(true);

      const response = await fetch(`/api/tenants/${tenantId}/users`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      onRoleChange?.(role);
    } catch (error) {
      console.error('Failed to update role:', error);
      setSelectedRole(currentRole); // Revert on error
      alert(error instanceof Error ? error.message : 'Failed to update role');
    } finally {
      setUpdating(false);
    }
  };

  if (!canChange) {
    const info = roleInfo[currentRole];
    return (
      <div className="flex items-center gap-2">
        {info.icon}
        <span className="font-medium">{info.label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select
        value={selectedRole}
        onValueChange={handleRoleChange}
        disabled={disabled || updating}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select role">
            {roleInfo[selectedRole] && (
              <div className="flex items-center gap-2">
                {roleInfo[selectedRole].icon}
                <span>{roleInfo[selectedRole].label}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(roleInfo) as TenantUserRole[]).map((role) => (
            <SelectItem key={role} value={role}>
              <div className="flex items-start gap-2 py-1">
                {roleInfo[role].icon}
                <div className="flex flex-col">
                  <span className="font-medium">{roleInfo[role].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {roleInfo[role].description}
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

export function RoleBadge({ role }: { role: TenantUserRole }) {
  const info = roleInfo[role];
  
  const colorClass = {
    owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    billing_admin: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    integration_manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    endpoint_manager: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    developer: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  }[role];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {info.icon}
      {info.label}
    </span>
  );
}
