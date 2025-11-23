import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/db';
import { createPasswordResetToken } from '@/lib/password-reset';
import { sendEmail } from '@/lib/email';
import { z } from 'zod';

const RequestResetSchema = z.object({
  email: z.string().email(),
});

// POST /api/auth/reset-password/request - Request a password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = RequestResetSchema.parse(body);

    // Find user by email
    const user = await getUserByEmail(email);

    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we return success
    if (!user) {
      return NextResponse.json({ 
        success: true, 
        message: 'If an account exists with this email, a password reset link will be sent.' 
      });
    }

    // Generate reset token
    const token = await createPasswordResetToken(user.id, 24); // 24 hour expiration

    // Generate reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password/${token}`;

    // Send password reset email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't request this, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 14px; word-break: break-all;">${resetUrl}</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this password reset, please ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't expose email sending failures to the user
    }

    return NextResponse.json({ 
      success: true, 
      message: 'If an account exists with this email, a password reset link will be sent.' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error requesting password reset:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
