import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  removeUserFromTenant,
  getUserRoleInTenant,
  updateUserRoleInTenant,
  getDB
} from '@/lib/db';
import { requirePermission, canManageUser as checkCanManageUser } from '@/lib/permission-middleware';
import { z } from 'zod';

const UpdateUserRoleSchema = z.object({
  role: z.string().optional(), // Can be a built-in role slug or custom role ID
  customRoleId: z.string().optional(),
  name: z.string().min(1).max(100).optional(), // Allow updating name
  email: z.string().email().optional(), // Allow updating email
}).refine(data => data.role || data.customRoleId || data.name || data.email, {
  message: 'At least one field (role, customRoleId, name, or email) must be provided',
});

// GET /api/tenants/[id]/users/[userId] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: tenantId, userId } = await params;

    // Check permission to read users
    const permission = await requirePermission('users', 'read', { 
      tenantId: tenantId
    });
    
    if (!permission.allowed || !permission.user) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const db = await getDB();
    
    // Get user details with tenant membership info
    const userDetails = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.name,
        tu.role,
        tu.customRoleId,
        tu.createdAt,
        cr.name as customRoleName
      FROM users u
      INNER JOIN tenant_users tu ON u.id = tu.userId
      LEFT JOIN custom_roles cr ON tu.customRoleId = cr.id
      WHERE tu.tenantId = ? AND u.id = ?
    `).get(tenantId, userId) as any;

    if (!userDetails) {
      return NextResponse.json(
        { error: 'User not found in this tenant' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: userDetails.id,
      email: userDetails.email,
      name: userDetails.name,
      role: userDetails.role,
      customRoleId: userDetails.customRoleId,
      customRoleName: userDetails.customRoleName,
      addedAt: userDetails.createdAt,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}

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

    const isEditingSelf = permission.user.id === userId;
    const db = await getDB();
    
    // Get manager's role in tenant
    const managerMembership = db.prepare(
      'SELECT role, customRoleId FROM tenant_users WHERE tenantId = ? AND userId = ?'
    ).get(id, permission.user.id) as { role: string; customRoleId: string | null } | undefined;
    
    const isManagerAdmin = managerMembership?.role === 'admin' || managerMembership?.role === 'owner';
    
    // System admins and tenant admins can manage any user
    // Other users with users.manage permission can only manage users with lower roles
    if (!permission.user.isAdmin && !isManagerAdmin) {
      // Non-admin users must have higher role than target user
      const canManage = await checkCanManageUser(permission.user.id, userId, id);
      if (!canManage) {
        return NextResponse.json(
          { error: 'Cannot manage user with equal or higher role' },
          { status: 403 }
        );
      }
    }
    
    // Users editing themselves cannot change their own role
    if (isEditingSelf && (validatedData.role || validatedData.customRoleId)) {
      const currentMembership = db.prepare(
        'SELECT role, customRoleId FROM tenant_users WHERE tenantId = ? AND userId = ?'
      ).get(id, userId) as { role: string | null; customRoleId: string | null } | undefined;
      
      if (currentMembership) {
        // Check if role is actually changing
        const isRoleChanging = 
          (validatedData.role && validatedData.role !== currentMembership.role) ||
          (validatedData.customRoleId && validatedData.customRoleId !== currentMembership.customRoleId);
        
        if (isRoleChanging) {
          return NextResponse.json(
            { error: 'You cannot change your own role' },
            { status: 403 }
          );
        }
      }
    }
    
    // Non-admin users cannot assign roles higher than or equal to their own
    if (!permission.user.isAdmin && !isManagerAdmin && (validatedData.role || validatedData.customRoleId)) {
      const roleHierarchy: Record<string, number> = {
        owner: 100,
        admin: 80,
        billing_admin: 70,
        integration_manager: 60,
        endpoint_manager: 60,
        developer: 40,
        viewer: 20,
      };
      
      const managerRoleLevel = roleHierarchy[managerMembership?.role || 'viewer'] || 0;
      
      // Check if trying to assign a role that's too high
      if (validatedData.role) {
        const targetRoleLevel = roleHierarchy[validatedData.role] || 0;
        if (targetRoleLevel >= managerRoleLevel) {
          return NextResponse.json(
            { error: 'You cannot assign a role equal to or higher than your own' },
            { status: 403 }
          );
        }
      }
    }

    // Update basic user properties (name, email) if provided and user is tenant admin
    if (validatedData.name || validatedData.email) {
      if (!isManagerAdmin && !permission.user.isAdmin) {
        return NextResponse.json(
          { error: 'Only tenant administrators can update user basic properties' },
          { status: 403 }
        );
      }
      
      const updates: string[] = [];
      const sqlParams: any[] = [];
      
      if (validatedData.name) {
        updates.push('name = ?');
        sqlParams.push(validatedData.name);
      }
      
      if (validatedData.email) {
        // Check if email is already taken
        const emailCheck = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(validatedData.email, userId);
        if (emailCheck) {
          return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }
        updates.push('email = ?');
        sqlParams.push(validatedData.email);
      }
      
      if (updates.length > 0) {
        updates.push('updatedAt = ?');
        sqlParams.push(new Date().toISOString());
        sqlParams.push(userId);
        
        db.prepare(`
          UPDATE users 
          SET ${updates.join(', ')}
          WHERE id = ?
        `).run(...sqlParams);
      }
    }
    
    // Update role if provided
    if (validatedData.role || validatedData.customRoleId) {
      // Determine if we're using a custom role or built-in role
      let builtInRole = null;
      let customRoleId = null;
      
      if (validatedData.customRoleId) {
        customRoleId = validatedData.customRoleId;
      } else if (validatedData.role) {
        // Check if the role is a built-in role slug
        const builtInRoles = ['owner', 'admin', 'billing_admin', 'integration_manager', 'endpoint_manager', 'developer', 'viewer'];
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

    // Log audit event
    const { logSecurityEvent } = await import('@/lib/audit-log');
    await logSecurityEvent('tenant_user_removed', {
      userId: user.id,
      tenantId: id,
      details: {
        removedUserId: userId,
        removedUserRole: targetRole
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing user from tenant:', error);
    return NextResponse.json(
      { error: 'Failed to remove user from tenant' },
      { status: 500 }
    );
  }
}
