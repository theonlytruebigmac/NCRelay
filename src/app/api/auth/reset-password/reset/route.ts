import { NextRequest, NextResponse } from 'next/server';
import { validateResetToken, markTokenAsUsed } from '@/lib/password-reset';
import { getDB } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/reset-password/reset - Reset password with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = ResetPasswordSchema.parse(body);

    // Validate the token and get user ID
    const userId = await validateResetToken(token);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password
    const db = await getDB();
    db.prepare(`
      UPDATE users
      SET hashedPassword = ?, updatedAt = ?
      WHERE id = ?
    `).run(hashedPassword, new Date().toISOString(), userId);

    // Mark token as used
    await markTokenAsUsed(token);

    // TODO: Add security audit log entry
    // TODO: Optionally revoke all active sessions for this user

    return NextResponse.json({ 
      success: true, 
      message: 'Password has been reset successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
