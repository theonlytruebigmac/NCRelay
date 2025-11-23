import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  permissions: z.array(z.object({
    resource: z.string(),
    action: z.string(),
    allowed: z.boolean(),
  })).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/tenants/[id]/roles/[roleId] - Get a specific role
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId, roleId } = await params;
    const db = await getDB();

    // Check if user has access to this tenant
    const membership = db.prepare(`
      SELECT role FROM tenant_users 
      WHERE tenantId = ? AND userId = ?
    `).get(tenantId, user.id) as any;

    if (!membership && !user.isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get role details
    const role = db.prepare(`
      SELECT 
        cr.id,
        cr.tenantId,
        cr.name,
        cr.slug,
        cr.description,
        cr.isBuiltIn,
        cr.isActive,
        cr.createdById,
        cr.createdAt,
        cr.updatedAt,
        u.name as createdByName
      FROM custom_roles cr
      LEFT JOIN users u ON cr.createdById = u.id
      WHERE cr.id = ? AND (cr.tenantId = ? OR cr.tenantId = 'system')
    `).get(roleId, tenantId) as any;

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Get permissions
    const permissions = db.prepare(`
      SELECT resource, action, allowed
      FROM custom_role_permissions
      WHERE roleId = ?
    `).all(roleId) as any[];

    // Count users with this role
    const userCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM tenant_users
      WHERE tenantId = ? AND (role = ? OR customRoleId = ?)
    `).get(tenantId, role.slug, roleId) as any;

    return NextResponse.json({
      ...role,
      permissions,
      userCount: userCount.count,
      isBuiltIn: !!role.isBuiltIn,
      isActive: !!role.isActive,
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json(
      { error: 'Failed to fetch role' },
      { status: 500 }
    );
  }
}

// PATCH /api/tenants/[id]/roles/[roleId] - Update a role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId, roleId } = await params;
    const body = await request.json();
    const validatedData = UpdateRoleSchema.parse(body);

    const db = await getDB();

    // Check if user has permission (owner or admin)
    const membership = db.prepare(`
      SELECT role FROM tenant_users 
      WHERE tenantId = ? AND userId = ?
    `).get(tenantId, user.id) as any;

    if (!membership && !user.isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!user.isAdmin && membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can update roles' }, { status: 403 });
    }

    // Get role
    const role = db.prepare(`
      SELECT id, isBuiltIn FROM custom_roles 
      WHERE id = ? AND tenantId = ?
    `).get(roleId, tenantId) as any;

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (role.isBuiltIn) {
      return NextResponse.json({ error: 'Cannot modify built-in roles' }, { status: 400 });
    }

    const updates: string[] = [];
    const sqlParams: any[] = [];

    if (validatedData.name !== undefined) {
      updates.push('name = ?');
      sqlParams.push(validatedData.name);
    }

    if (validatedData.description !== undefined) {
      updates.push('description = ?');
      sqlParams.push(validatedData.description);
    }

    if (validatedData.isActive !== undefined) {
      updates.push('isActive = ?');
      sqlParams.push(validatedData.isActive ? 1 : 0);
    }

    const now = new Date().toISOString();
    updates.push('updatedAt = ?');
    sqlParams.push(now);
    sqlParams.push(roleId);

    if (updates.length > 1) { // More than just updatedAt
      db.prepare(`
        UPDATE custom_roles 
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...sqlParams);
    }

    // Update permissions if provided
    if (validatedData.permissions) {
      // Delete existing permissions
      db.prepare(`DELETE FROM custom_role_permissions WHERE roleId = ?`).run(roleId);

      // Insert new permissions
      const insertPermission = db.prepare(`
        INSERT INTO custom_role_permissions (id, roleId, resource, action, allowed, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const perm of validatedData.permissions) {
        insertPermission.run(
          uuidv4(),
          roleId,
          perm.resource,
          perm.action,
          perm.allowed ? 1 : 0,
          now,
          now
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

    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}

// DELETE /api/tenants/[id]/roles/[roleId] - Delete a role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId, roleId } = await params;
    const db = await getDB();

    // Check if user has permission (owner only)
    const membership = db.prepare(`
      SELECT role FROM tenant_users 
      WHERE tenantId = ? AND userId = ?
    `).get(tenantId, user.id) as any;

    if (!membership && !user.isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!user.isAdmin && membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can delete roles' }, { status: 403 });
    }

    // Get role
    const role = db.prepare(`
      SELECT id, isBuiltIn FROM custom_roles 
      WHERE id = ? AND tenantId = ?
    `).get(roleId, tenantId) as any;

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (role.isBuiltIn) {
      return NextResponse.json({ error: 'Cannot delete built-in roles' }, { status: 400 });
    }

    // Check if any users have this role
    const usersWithRole = db.prepare(`
      SELECT COUNT(*) as count
      FROM tenant_users
      WHERE customRoleId = ?
    `).get(roleId) as any;

    if (usersWithRole.count > 0) {
      return NextResponse.json({ 
        error: `Cannot delete role: ${usersWithRole.count} user(s) currently have this role` 
      }, { status: 400 });
    }

    // Delete role (permissions will cascade)
    db.prepare(`DELETE FROM custom_roles WHERE id = ?`).run(roleId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}
