import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserRoleInTenant } from '@/lib/db';
import { getRolePermissions } from '@/lib/rbac';

// GET /api/tenants/[id]/permissions - Get permissions for current user in tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get user's role in this tenant
    const role = await getUserRoleInTenant(id, user.id);

    if (!role && !user.isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // System admins get owner-level permissions
    const effectiveRole = user.isAdmin ? 'owner' : role;

    if (!effectiveRole) {
      return NextResponse.json({ error: 'No role found' }, { status: 403 });
    }

    // Get all permissions for this role
    const permissions = await getRolePermissions(effectiveRole, id);

    // Convert to map for easy lookup
    const permissionsMap: Record<string, boolean> = {};
    for (const perm of permissions) {
      const key = `${perm.resource}:${perm.action}`;
      permissionsMap[key] = perm.allowed;
    }

    return NextResponse.json({
      role: effectiveRole,
      permissions: permissionsMap,
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
