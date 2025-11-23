import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  removeUserFromTenant,
  getUserRoleInTenant,
  updateUserRoleInTenant
} from '@/lib/db';
import { requirePermission, canManageUser as checkCanManageUser } from '@/lib/permission-middleware';
import { z } from 'zod';

const UpdateUserRoleSchema = z.object({
  role: z.string().optional(), // Can be a built-in role slug or custom role ID
  customRoleId: z.string().optional(),
}).refine(data => data.role || data.customRoleId, {
  message: 'Either role or customRoleId must be provided',
});

// PATCH /api/tenants/[id]/users/[userId] - Update user role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;

    // Check permission to manage users
    const permission = await requirePermission('users', 'manage', { 
      tenantId: id,
      logAction: true 
    });
    
    if (!permission.allowed || !permission.user) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = UpdateUserRoleSchema.parse(body);

    // System admins can manage any user
    if (!permission.user.isAdmin) {
      // Check if the user can manage the target user (must have higher role)
      const canManage = await checkCanManageUser(permission.user.id, userId, id);
      if (!canManage) {
        return NextResponse.json(
          { error: 'Cannot manage user with equal or higher role' },
          { status: 403 }
        );
      }
    }

    // Determine if we're using a custom role or built-in role
    let builtInRole = null;
    let customRoleId = null;
    
    if (validatedData.customRoleId) {
      customRoleId = validatedData.customRoleId;
    } else if (validatedData.role) {
      // Check if the role is a built-in role slug
      const builtInRoles = ['owner', 'admin', 'integration_manager', 'endpoint_manager', 'developer', 'viewer'];
      if (builtInRoles.includes(validatedData.role)) {
        builtInRole = validatedData.role as any;
      } else {
        // It's a custom role ID passed as 'role'
        customRoleId = validatedData.role;
      }
    }

    const success = await updateUserRoleInTenant(
      id,
      userId,
      builtInRole as any,
      customRoleId
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}

// DELETE /api/tenants/[id]/users/[userId] - Remove user from tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, userId } = await params;

    // Check permissions
    let canRemove = user.isAdmin;
    if (!canRemove) {
      const userRole = await getUserRoleInTenant(id, user.id);
      canRemove = userRole === 'owner' || userRole === 'admin';
    }

    if (!canRemove) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Prevent removing the last owner
    const targetRole = await getUserRoleInTenant(id, userId);
    if (targetRole === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove tenant owner. Transfer ownership first.' },
        { status: 400 }
      );
    }

    const success = await removeUserFromTenant(id, userId);

    if (!success) {
      return NextResponse.json(
        { error: 'User not found in tenant' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing user from tenant:', error);
    return NextResponse.json(
      { error: 'Failed to remove user from tenant' },
      { status: 500 }
    );
  }
}
