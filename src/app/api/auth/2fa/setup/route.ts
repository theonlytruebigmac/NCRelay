import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  generateTwoFactorSecret,
  generateQRCode,
  generateBackupCodes,
  enrollUserIn2FA,
  verifyTwoFactorToken,
} from '@/lib/two-factor';

// POST /api/auth/2fa/setup - Initialize 2FA setup
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate secret and QR code
    const { secret, otpauth_url } = generateTwoFactorSecret(user.email);
    const qrCode = await generateQRCode(otpauth_url);
    
    // Store secret in session/temp storage (not in DB yet - only after verification)
    // For now, return it to client for verification
    return NextResponse.json({
      secret,
      qrCode,
      manualEntryKey: secret, // For manual entry if QR doesn't work
    });
  } catch (error) {
    console.error('Error initializing 2FA setup:', error);
    return NextResponse.json(
      { error: 'Failed to initialize 2FA setup' },
      { status: 500 }
    );
  }
}
