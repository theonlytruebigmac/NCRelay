import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  enrollUserIn2FA,
  verifyTwoFactorToken,
  generateBackupCodes,
} from '@/lib/two-factor';
import { z } from 'zod';
import { logSecurityEvent } from '@/lib/audit-log';
import { getRequestContext } from '@/lib/utils';

const VerifySchema = z.object({
  secret: z.string(),
  token: z.string().length(6),
});

// POST /api/auth/2fa/verify - Verify and enable 2FA
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { secret, token } = VerifySchema.parse(body);

    // Verify the token
    const isValid = verifyTwoFactorToken(secret, token);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);

    // Enable 2FA for the user
    await enrollUserIn2FA(user.id, secret, backupCodes, false);
    
    // Log 2FA enrollment
    const { ipAddress, userAgent } = getRequestContext(request);
    await logSecurityEvent('2fa_enrolled', {
      userId: user.id,
      details: { email: user.email },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      backupCodes,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error verifying 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to verify 2FA' },
      { status: 500 }
    );
  }
}
