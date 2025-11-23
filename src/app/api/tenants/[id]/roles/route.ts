import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Schema for creating a custom role
const CreateRoleSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  description: z.string().optional(),
  permissions: z.array(z.object({
    resource: z.string(),
    action: z.string(),
    allowed: z.boolean(),
  })),
});

// Schema for updating a custom role
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

// GET /api/tenants/[id]/roles - List all roles for a tenant (built-in + custom)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId } = await params;
    const db = await getDB();

    // Check if user has access to this tenant
    const membership = db.prepare(`
      SELECT role, customRoleId FROM tenant_users 
      WHERE tenantId = ? AND userId = ?
    `).get(tenantId, user.id) as any;

    if (!membership && !user.isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get custom roles for this tenant
    const customRoles = db.prepare(`
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
      WHERE cr.tenantId = ? OR cr.tenantId = 'system'
      ORDER BY cr.isBuiltIn DESC, cr.name ASC
    `).all(tenantId) as any[];

    // Get permissions for each role
    const rolesWithPermissions = customRoles.map(role => {
      const permissions = db.prepare(`
        SELECT resource, action, allowed
        FROM custom_role_permissions
        WHERE roleId = ?
      `).all(role.id) as any[];

      return {
        ...role,
        permissions,
        isBuiltIn: !!role.isBuiltIn,
        isActive: !!role.isActive,
      };
    });

    return NextResponse.json({ roles: rolesWithPermissions });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

// POST /api/tenants/[id]/roles - Create a new custom role
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId } = await params;
    const body = await request.json();
    const validatedData = CreateRoleSchema.parse(body);

    const db = await getDB();

    // Check if user has permission to create roles (owner or admin)
    const membership = db.prepare(`
      SELECT role, customRoleId FROM tenant_users 
      WHERE tenantId = ? AND userId = ?
    `).get(tenantId, user.id) as any;

    if (!membership && !user.isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!user.isAdmin && membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can create roles' }, { status: 403 });
    }

    // Check if slug already exists
    const existing = db.prepare(`
      SELECT id FROM custom_roles 
      WHERE tenantId = ? AND slug = ?
    `).get(tenantId, validatedData.slug);

    if (existing) {
      return NextResponse.json({ error: 'Role slug already exists' }, { status: 400 });
    }

    const roleId = uuidv4();
    const now = new Date().toISOString();

    // Insert role
    db.prepare(`
      INSERT INTO custom_roles (id, tenantId, name, slug, description, isBuiltIn, createdById, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      roleId,
      tenantId,
      validatedData.name,
      validatedData.slug,
      validatedData.description || null,
      user.id,
      now,
      now
    );

    // Insert permissions
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

    return NextResponse.json({ 
      success: true,
      roleId,
      message: 'Role created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}
