import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import { getAllSessions, revokeSession, revokeAllUserSessions } from '@/lib/session-manager';

// GET /api/admin/sessions - Get all active sessions (admin only)
export async function GET(request: NextRequest) {
  try {
    const permission = await requirePermission('users', 'manage', {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const sessions = await getAllSessions(limit);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching all sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sessions/:sessionId - Revoke any session (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const permission = await requirePermission('users', 'manage', {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (userId) {
      // Revoke all sessions for a specific user
      const count = await revokeAllUserSessions(userId);
      return NextResponse.json({ 
        success: true, 
        message: `Revoked ${count} session(s) for user`,
        count 
      });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID or User ID required' },
        { status: 400 }
      );
    }

    await revokeSession(sessionId);

    return NextResponse.json({ 
      success: true, 
      message: 'Session revoked successfully' 
    });
  } catch (error) {
    console.error('Error revoking session:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}
