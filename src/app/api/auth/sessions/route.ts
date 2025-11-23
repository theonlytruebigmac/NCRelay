import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserSessions, revokeSession, revokeOtherSessions } from '@/lib/session-manager';

// GET /api/auth/sessions - Get current user's active sessions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await getUserSessions(user.id);
    
    // Get current session token from cookie to mark it
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const currentSessionToken = cookieStore.get('session-token')?.value;
    
    // Get geolocation for each session (in parallel)
    const { getLocationFromIP } = await import('@/lib/session-manager');
    const sessionsWithLocation = await Promise.all(
      sessions.map(async (session) => {
        const location = await getLocationFromIP(session.ipAddress);
        return {
          ...session,
          location,
          isCurrent: session.sessionToken === currentSessionToken,
        };
      })
    );

    return NextResponse.json({ sessions: sessionsWithLocation });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/sessions/:sessionId - Revoke a specific session
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const revokeOthers = searchParams.get('revokeOthers') === 'true';

    if (revokeOthers) {
      // Get current session token from cookie
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const currentSessionToken = cookieStore.get('session-token')?.value || '';
      
      const count = await revokeOtherSessions(user.id, currentSessionToken);
      
      return NextResponse.json({ 
        success: true, 
        message: `Revoked ${count} session(s)`,
        count 
      });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
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
