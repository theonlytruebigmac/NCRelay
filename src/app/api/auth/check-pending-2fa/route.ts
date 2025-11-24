import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// GET /api/auth/check-pending-2fa - Check if there's a valid pending 2FA session
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const pending2FAData = cookieStore.get('pending-2fa')?.value;

  if (!pending2FAData) {
    return NextResponse.json({ error: 'No pending 2FA session' }, { status: 401 });
  }

  try {
    const pendingSession = JSON.parse(pending2FAData);
    
    // Check if session expired
    if (Date.now() > pendingSession.expiresAt) {
      cookieStore.delete('pending-2fa');
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid session data' }, { status: 400 });
  }
}
