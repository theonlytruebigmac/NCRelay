import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getRequestContext } from '@/lib/utils';
import { logSecurityEvent } from '@/lib/audit-log';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
  isAdmin: z.boolean().optional(),
});

// GET /api/admin/users - List all users (system admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Only system administrators can access this endpoint' }, { status: 403 });
    }

    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = `
      SELECT 
        u.id,
        u.email,
        u.name,
        u.isAdmin,
        u.createdAt,
        u.updatedAt,
        COUNT(DISTINCT tu.tenantId) as tenantCount
      FROM users u
      LEFT JOIN tenant_users tu ON u.id = tu.userId
    `;

    const params: any[] = [];

    if (search) {
      query += ` WHERE u.email LIKE ? OR u.name LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY u.id ORDER BY u.createdAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const users = db.prepare(query).all(...params);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create new user (system admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Only system administrators can create users' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = CreateUserSchema.parse(body);

    const db = await getDB();

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(validatedData.email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    const now = new Date().toISOString();
    const userId = uuidv4();

    // Create user
    db.prepare(`
      INSERT INTO users (id, email, name, hashedPassword, isAdmin, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      validatedData.email,
      validatedData.name,
      hashedPassword,
      validatedData.isAdmin ? 1 : 0,
      now,
      now
    );

    // Create notification preferences
    try {
      const { ensureNotificationPreferences } = await import('@/lib/notification-preferences');
      await ensureNotificationPreferences(userId);
    } catch (error) {
      console.error('Failed to create notification preferences:', error);
    }

    const newUser = {
      id: userId,
      email: validatedData.email,
      name: validatedData.name,
      isAdmin: !!validatedData.isAdmin,
      createdAt: now,
      updatedAt: now,
    };

    // Log user creation
    const { ipAddress, userAgent } = getRequestContext(request);
    await logSecurityEvent('user_created', {
      userId: userId,
      details: { 
        email: validatedData.email,
        name: validatedData.name,
        isAdmin: validatedData.isAdmin,
        createdBy: user.id,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
