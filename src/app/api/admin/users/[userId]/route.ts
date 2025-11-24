import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getRequestContext } from '@/lib/utils';
import { logSecurityEvent } from '@/lib/audit-log';

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  isAdmin: z.union([z.boolean(), z.number()]).transform(val => !!val).optional(),
});

// GET /api/admin/users/[userId] - Get user details (system admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Only system administrators can access this endpoint' }, { status: 403 });
    }

    const { userId } = await params;
    const db = await getDB();

    // Get user details
    const userDetails = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.isAdmin,
        u.createdAt,
        u.updatedAt
      FROM users u
      WHERE u.id = ?
    `).get(userId) as any;

    if (!userDetails) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get tenant memberships
    const tenants = db.prepare(`
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.plan,
        tu.role,
        tu.createdAt as joinedAt
      FROM tenant_users tu
      INNER JOIN tenants t ON tu.tenantId = t.id
      WHERE tu.userId = ?
      ORDER BY tu.createdAt DESC
    `).all(userId) as any[];

    return NextResponse.json({ 
      user: {
        ...userDetails,
        isAdmin: !!userDetails.isAdmin,
      },
      tenants 
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users/[userId] - Update user (system admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Only system administrators can update users' }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const validatedData = UpdateUserSchema.parse(body);

    const db = await getDB();

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build update query
    const updates: string[] = [];
    const sqlParams: any[] = [];

    if (validatedData.name !== undefined) {
      updates.push('name = ?');
      sqlParams.push(validatedData.name);
    }

    if (validatedData.email !== undefined) {
      // Check if email is already taken
      const emailCheck = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(validatedData.email, userId);
      if (emailCheck) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
      updates.push('email = ?');
      sqlParams.push(validatedData.email);
    }

    if (validatedData.password !== undefined) {
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      updates.push('hashedPassword = ?');
      sqlParams.push(hashedPassword);
    }
    
    const passwordChanged = validatedData.password !== undefined;

    if (validatedData.isAdmin !== undefined) {
      updates.push('isAdmin = ?');
      sqlParams.push(validatedData.isAdmin ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updates.push('updatedAt = ?');
    sqlParams.push(new Date().toISOString());
    sqlParams.push(userId);

    db.prepare(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...sqlParams);

    const { ipAddress, userAgent } = getRequestContext(request);
    
    // Log role changes specifically
    if (validatedData.isAdmin !== undefined) {
      await logSecurityEvent('role_changed', {
        userId: userId,
        details: { 
          changedBy: user.id,
          isAdmin: validatedData.isAdmin,
          ...validatedData,
        },
        ipAddress,
        userAgent,
      });
    }
    
    // Log password changes by admin
    if (passwordChanged) {
      await logSecurityEvent('password_changed', {
        userId: userId,
        details: { 
          changedBy: user.id,
          changedByAdmin: true,
        },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[userId] - Delete user (system admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Only system administrators can delete users' }, { status: 403 });
    }

    const { userId } = await params;

    // Prevent deleting yourself
    if (user.id === userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const db = await getDB();

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user details before deletion for audit log
    const userToDelete = db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId) as any;

    // Delete user (cascade will handle tenant_users, etc.)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    // Log user deletion
    const { ipAddress, userAgent } = getRequestContext(request);
    await logSecurityEvent('user_deleted', {
      userId: userId,
      details: { 
        email: userToDelete?.email,
        name: userToDelete?.name,
        deletedBy: user.id,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
