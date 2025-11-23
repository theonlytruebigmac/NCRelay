import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getUserTwoFactorConfig,
  disableTwoFactor,
  regenerateBackupCodes,
} from '@/lib/two-factor';
import { logSecurityEvent } from '@/lib/audit-log';
import { getRequestContext } from '@/lib/utils';

// GET /api/auth/2fa/status - Get user's 2FA status
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getUserTwoFactorConfig(user.id);

    return NextResponse.json({
      isEnabled: config?.isEnabled || false,
      enforcedByAdmin: config?.enforcedByAdmin || false,
      enrolledAt: config?.enrolledAt,
      lastUsedAt: config?.lastUsedAt,
      backupCodesRemaining: config?.backupCodes.filter(bc => !bc.used).length || 0,
    });
  } catch (error) {
    console.error('Error fetching 2FA status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 2FA status' },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/2fa/status - Disable 2FA
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getUserTwoFactorConfig(user.id);
    
    // Don't allow disabling if enforced by admin
    if (config?.enforcedByAdmin) {
      return NextResponse.json(
        { error: '2FA is required by your administrator and cannot be disabled' },
        { status: 403 }
      );
    }

    await disableTwoFactor(user.id);

    const { ipAddress, userAgent } = getRequestContext(request);
    await logSecurityEvent('2fa_disabled', {
      userId: user.id,
      tenantId: user.tenantId,
      details: { email: user.email },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}

// POST /api/auth/2fa/backup-codes - Regenerate backup codes
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newBackupCodes = await regenerateBackupCodes(user.id);

    return NextResponse.json({
      backupCodes: newBackupCodes,
    });
  } catch (error) {
    console.error('Error regenerating backup codes:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate backup codes' },
      { status: 500 }
    );
  }
}
