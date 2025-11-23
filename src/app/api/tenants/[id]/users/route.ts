import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  getUsersInTenant,
  addUserToTenant,
  updateUserRoleInTenant,
  removeUserFromTenant,
  getUserRoleInTenant,
  getUserByEmail
} from '@/lib/db';
import { requirePermission, canManageUser as checkCanManageUser } from '@/lib/permission-middleware';
import { sendWelcomeEmail } from '@/lib/welcome-email';
import { z } from 'zod';

const AddUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(), // Optional name for new users
  password: z.string().min(8).optional(), // Optional password for new users
  role: z.string().optional(), // Can be built-in role slug or custom role slug
  customRoleId: z.string().optional(),
});

const UpdateUserRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'integration_manager', 'endpoint_manager', 'developer', 'viewer']),
});

// GET /api/tenants/[id]/users - List users in tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check permission to read users
    const permission = await requirePermission('users', 'read', { tenantId: id });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const users = await getUsersInTenant(id);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/tenants/[id]/users - Add user to tenant
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check permission to create users
    const permission = await requirePermission('users', 'create', { 
      tenantId: id,
      logAction: true 
    });
    
    if (!permission.allowed || !permission.user) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = AddUserSchema.parse(body);

    // Find user by email - if not found, we'll create a new user
    let targetUser = await getUserByEmail(validatedData.email);
    
    // Track if we're creating a new user and what password to send
    let isNewUser = false;
    let userPassword: string | undefined = undefined;
    
    if (!targetUser) {
      // Create new user with provided or auto-generated password
      isNewUser = true;
      const { getDB } = await import('@/lib/db');
      const bcrypt = await import('bcryptjs');
      const { v4: uuidv4 } = await import('uuid');
      
      const db = await getDB();
      const userId = uuidv4();
      
      // Use provided password or generate a temporary one
      userPassword = validatedData.password || (Math.random().toString(36).slice(-12) + 'A1!');
      const hashedPassword = await bcrypt.hash(userPassword, 10);
      
      // Use provided name or derive from email
      const userName = validatedData.name || validatedData.email.split('@')[0];
      
      db.prepare(`
        INSERT INTO users (id, email, name, hashedPassword, isAdmin, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `).run(
        userId,
        validatedData.email,
        userName,
        hashedPassword,
        new Date().toISOString(),
        new Date().toISOString()
      );
      
      targetUser = { id: userId, email: validatedData.email, name: userName } as any;
    } else {
      // Check if user is already in tenant
      const existingRole = await getUserRoleInTenant(id, targetUser.id);
      if (existingRole) {
        return NextResponse.json(
          { error: 'User is already a member of this tenant' },
          { status: 400 }
        );
      }
    }

    // Determine if using custom role or built-in role
    let builtInRole: any = 'viewer';
    let customRoleId: string | null = null;
    
    if (validatedData.customRoleId) {
      customRoleId = validatedData.customRoleId;
      builtInRole = undefined;
    } else if (validatedData.role) {
      const builtInRoles = ['owner', 'admin', 'integration_manager', 'endpoint_manager', 'developer', 'viewer'];
      if (builtInRoles.includes(validatedData.role)) {
        builtInRole = validatedData.role;
      } else {
        // Assume it's a custom role ID
        customRoleId = validatedData.role;
        builtInRole = undefined;
      }
    }

    const tenantUser = await addUserToTenant(
      id,
      targetUser.id,
      builtInRole,
      customRoleId
    );

    // Send welcome email
    const { getDB } = await import('@/lib/db');
    const db = await getDB();
    const tenant = db.prepare('SELECT name FROM tenants WHERE id = ?').get(id) as { name: string } | undefined;
    
    await sendWelcomeEmail({
      toEmail: targetUser.email,
      userName: targetUser.name || targetUser.email.split('@')[0],
      password: isNewUser ? userPassword : undefined,
      tenantId: id,
      tenantName: tenant?.name,
      isNewUser,
    });

    return NextResponse.json({ tenantUser }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error adding user to tenant:', error);
    return NextResponse.json(
      { error: 'Failed to add user to tenant' },
      { status: 500 }
    );
  }
}

// DELETE /api/tenants/[id]/users/[userId] - handled in separate route file
