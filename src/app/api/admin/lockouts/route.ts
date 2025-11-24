import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import { getLockedAccounts, unlockAccount, getUserLockoutHistory } from '@/lib/account-lockout';

// GET /api/admin/lockouts - Get all locked accounts
export async function GET(request: NextRequest) {
  try {
    const permission = await requirePermission('users', 'manage', {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // Get lockout history for specific user
      const history = await getUserLockoutHistory(userId);
      return NextResponse.json({ history });
    }

    // Get all currently locked accounts
    const lockedAccounts = await getLockedAccounts();

    return NextResponse.json({ lockedAccounts });
  } catch (error) {
    console.error('Error fetching lockouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lockouts' },
      { status: 500 }
    );
  }
}

// POST /api/admin/lockouts/unlock - Unlock an account
export async function POST(request: NextRequest) {
  try {
    const permission = await requirePermission('users', 'manage', {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    if (!permission.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    await unlockAccount(userId, permission.user.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Account unlocked successfully' 
    });
  } catch (error) {
    console.error('Error unlocking account:', error);
    return NextResponse.json(
      { error: 'Failed to unlock account' },
      { status: 500 }
    );
  }
}
