import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import { getUserTwoFactorConfig, resetTwoFactor, enrollUserIn2FA, generateBackupCodes } from '@/lib/two-factor';
import { logSecurityEvent } from '@/lib/audit-log';
import { getUserById } from '@/lib/db';
import { getRequestContext } from '@/lib/utils';

// GET /api/admin/users/[userId]/2fa - Get user's 2FA status (admin view)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Check if user has permission to manage users
    const permission = await requirePermission('users', 'manage', {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const config = await getUserTwoFactorConfig(userId);

    if (!config) {
      return NextResponse.json({
        isEnabled: false,
        enforcedByAdmin: false,
        enrolledAt: null,
        lastUsedAt: null,
        backupCodesRemaining: 0,
      });
    }

    return NextResponse.json({
      isEnabled: config.isEnabled,
      enforcedByAdmin: config.enforcedByAdmin,
      enrolledAt: config.enrolledAt,
      lastUsedAt: config.lastUsedAt,
      backupCodesRemaining: config.backupCodes.filter(bc => !bc.used).length,
    });
  } catch (error) {
    console.error('Error fetching user 2FA status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 2FA status' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[userId]/2fa - Reset user's 2FA (admin action)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const permission = await requirePermission('users', 'manage', {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    await resetTwoFactor(userId);
    
    // Log 2FA reset
    const user = await getUserById(userId);
    if (user) {
      const { ipAddress, userAgent } = getRequestContext(request);
      await logSecurityEvent('2fa_reset', {
        userId: user.id,
        tenantId: user.tenantId,
        details: { 
          resetBy: permission.user?.id,
          email: user.email 
        },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({ success: true, message: '2FA has been reset for this user' });
  } catch (error) {
    console.error('Error resetting user 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to reset 2FA' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users/[userId]/2fa/enforce - Enforce 2FA for specific user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const permission = await requirePermission('users', 'manage', {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { enforce } = body;

    if (enforce === undefined) {
      return NextResponse.json({ error: 'Missing enforce parameter' }, { status: 400 });
    }

    if (enforce) {
      // Check if user already has 2FA
      const config = await getUserTwoFactorConfig(userId);
      
      if (!config || !config.isEnabled) {
        // User doesn't have 2FA yet, set up placeholder that requires enrollment
        const { getDB } = await import('@/lib/db');
        const db = await getDB();
        
        db.prepare(`
          INSERT INTO user_2fa (userId, secret, backupCodes, isEnabled, enforcedByAdmin, enrolledAt)
          VALUES (?, '', '[]', 0, 1, NULL)
          ON CONFLICT(userId) DO UPDATE SET enforcedByAdmin = 1
        `).run(userId);
      } else {
        // User already has 2FA, just set enforced flag
        const { getDB } = await import('@/lib/db');
        const db = await getDB();
        
        db.prepare(`
          UPDATE user_2fa SET enforcedByAdmin = 1 WHERE userId = ?
        `).run(userId);
      }
    } else {
      // Remove enforcement
      const { getDB } = await import('@/lib/db');
      const db = await getDB();
      
      db.prepare(`
        UPDATE user_2fa SET enforcedByAdmin = 0 WHERE userId = ?
      `).run(userId);
    }
    
    // Log 2FA enforcement change
    const user = await getUserById(userId);
    if (user) {
      const { ipAddress, userAgent } = getRequestContext(request);
      await logSecurityEvent(enforce ? '2fa_enforced' : '2fa_unenforced', {
        userId: user.id,
        tenantId: user.tenantId,
        details: { 
          enforcedBy: permission.user?.id,
          email: user.email 
        },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: enforce ? '2FA has been enforced for this user' : '2FA enforcement removed for this user'
    });
  } catch (error) {
    console.error('Error enforcing 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to update 2FA enforcement' },
      { status: 500 }
    );
  }
}
