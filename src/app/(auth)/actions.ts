
'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import * as db from '@/lib/db';
import type { User } from '@/lib/types';
import { sendPasswordResetEmail } from '@/lib/email';
import { createPasswordResetToken, validateResetToken, markTokenAsUsed } from '@/lib/password-reset';
import { revalidatePath } from 'next/cache';
import { setAuthCookie, removeAuthCookie } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { logSecurityEvent } from '@/lib/audit-log';
import { headers } from 'next/headers';

/**
 * Helper to get IP address and User-Agent from server action context
 */
async function getServerActionContext(): Promise<{ ipAddress: string; userAgent: string }> {
  const headersList = await headers();
  
  // Extract IP address from headers
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIP = headersList.get('x-real-ip');
  const cfConnecting = headersList.get('cf-connecting-ip');
  const vercelIP = headersList.get('x-vercel-proxied-for') || headersList.get('x-vercel-ip');
  
  let ipAddress = 'unknown';
  if (forwardedFor) {
    ipAddress = forwardedFor.split(',')[0].trim();
  } else if (realIP) {
    ipAddress = realIP.trim();
  } else if (cfConnecting) {
    ipAddress = cfConnecting.trim();
  } else if (vercelIP) {
    ipAddress = vercelIP.trim();
  }
  
  const userAgent = headersList.get('user-agent') || 'unknown';
  
  return { ipAddress, userAgent };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password cannot be empty."), // Min 1 for presence, actual length check is on hashing
});

export async function loginAction(formData: FormData): Promise<{ success?: boolean; error?: string; requires2FA?: boolean; pendingUserId?: string; lockedUntil?: string }> {
  const validatedFields = loginSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { error: "Invalid email or password format." };
  }

  const { email, password } = validatedFields.data;
  const { ipAddress, userAgent } = await getServerActionContext();

  const existingUser = await db.getUserByEmail(email);

  if (!existingUser || !existingUser.hashedPassword) {
    // Record failed attempt
    const { recordFailedLogin } = await import('@/lib/account-lockout');
    await recordFailedLogin(email, null, 'User not found');
    
    // Log failed login attempt
    await logSecurityEvent('login_failed', {
      details: { reason: 'User not found', email },
      ipAddress,
      userAgent,
    });
    
    return { error: "Invalid email or password." };
  }

  // Check if account is locked
  const { isAccountLocked } = await import('@/lib/account-lockout');
  const { isLocked, lockout } = await isAccountLocked(existingUser.id);
  
  if (isLocked && lockout) {
    const unlockDate = new Date(lockout.unlockAt);
    const minutesRemaining = Math.ceil((unlockDate.getTime() - Date.now()) / 60000);
    
    // Log locked account login attempt
    await logSecurityEvent('login_locked', {
      userId: existingUser.id,
      tenantId: existingUser.tenantId,
      details: { minutesRemaining },
      ipAddress,
      userAgent,
    });
    
    return { 
      error: `Account is locked due to too many failed login attempts. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
      lockedUntil: lockout.unlockAt
    };
  }

  const passwordMatch = await bcrypt.compare(password, existingUser.hashedPassword);

  if (!passwordMatch) {
    // Record failed attempt and check if should lock
    const { recordFailedLogin, checkAndLockAccount } = await import('@/lib/account-lockout');
    await recordFailedLogin(email, null, 'Invalid password');
    
    const lockResult = await checkAndLockAccount(email, 5, 15);
    
    // Log failed login attempt
    await logSecurityEvent('login_failed', {
      userId: existingUser.id,
      tenantId: existingUser.tenantId,
      details: { 
        reason: 'Invalid password',
        attemptsRemaining: lockResult.attemptsRemaining 
      },
      ipAddress,
      userAgent,
    });
    
    if (lockResult.shouldLock) {
      return { 
        error: "Too many failed login attempts. Your account has been locked for 15 minutes.",
        lockedUntil: lockResult.lockedUntil?.toISOString()
      };
    }
    
    return { 
      error: `Invalid email or password. ${lockResult.attemptsRemaining} attempt${lockResult.attemptsRemaining !== 1 ? 's' : ''} remaining.`
    };
  }
  
  // Successful login - clear failed attempts
  const { clearFailedAttempts } = await import('@/lib/account-lockout');
  await clearFailedAttempts(email);
  
  // Check if 2FA is enabled
  const { getUserTwoFactorConfig } = await import('@/lib/two-factor');
  const twoFactorConfig = await getUserTwoFactorConfig(existingUser.id);
  
  if (twoFactorConfig && twoFactorConfig.isEnabled) {
    // Store pending user ID in a temporary cookie (will be verified with 2FA)
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    
    // Create a temporary token for 2FA verification (5 minute expiration)
    const crypto = await import('crypto');
    const tempToken = crypto.randomBytes(32).toString('hex');
    
    // Store in a pending-2fa cookie
    cookieStore.set('pending-2fa', JSON.stringify({ 
      userId: existingUser.id, 
      token: tempToken,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
    });
    
    return { requires2FA: true, pendingUserId: existingUser.id };
  }
  
  const { hashedPassword, ...userToReturn } = existingUser;
  
  // Log successful login
  await logSecurityEvent('login_success', {
    userId: existingUser.id,
    tenantId: existingUser.tenantId,
    details: { email: existingUser.email },
    ipAddress,
    userAgent,
  });
  
  // Set authentication cookie and create session
  await setAuthCookie(userToReturn as User, ipAddress, userAgent);
  
  return { success: true };
}

export async function logoutAction(): Promise<void> {
  // Get current user before removing cookie
  const { getCurrentUser } = await import('@/lib/auth');
  const user = await getCurrentUser();
  
  if (user) {
    const { ipAddress, userAgent } = await getServerActionContext();
    await logSecurityEvent('logout', {
      userId: user.id,
      tenantId: user.tenantId,
      details: { email: user.email },
      ipAddress,
      userAgent,
    });
  }
  
  await removeAuthCookie();
  redirect('/login');
}


const emailValidationSchema = z.string().email({ message: "Invalid email address." });

export async function sendPasswordResetLinkAction(formData: FormData): Promise<{ success?: boolean; error?: string; message?: string }> {
  const email = formData.get('email') as string;
  const validatedEmail = emailValidationSchema.safeParse(email);

  if (!validatedEmail.success) {
    return { error: "Invalid email address." };
  }

  const user = await db.getUserByEmail(validatedEmail.data);
  if (!user) {
    // Don't reveal if user exists, but for prototyping/logging:
    console.log(`Password reset attempt for non-existent user: ${validatedEmail.data}`);
    // Still return a success-like message to prevent email enumeration
    return { message: "If an account with this email exists, a password reset link has been sent." };
  }

  try {
    const token = await createPasswordResetToken(user.id, 24);
    await sendPasswordResetEmail(user.email, token);
    
    // Log password reset request
    const { ipAddress, userAgent } = await getServerActionContext();
    await logSecurityEvent('password_reset_requested', {
      userId: user.id,
      tenantId: user.tenantId,
      details: { email: user.email },
      ipAddress,
      userAgent,
    });
    
    return { success: true, message: "If an account with this email exists, a password reset link has been sent." };
  } catch (error) {
    console.error("Send password reset link error:", error);
    return { error: "Could not send password reset email. Please try again later." };
  }
}

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function resetPasswordAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const data = Object.fromEntries(formData.entries());
  const validatedFields = resetPasswordSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors.password?.[0] || "Invalid input." };
  }

  const { token, password } = validatedFields.data;

  // Validate token and get user ID
  const userId = await validateResetToken(token);

  if (!userId) {
    return { error: "Invalid or expired password reset token." };
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Update password
  const success = await db.updateUserPassword(userId, hashedPassword);

  if (success) {
    // Mark token as used
    await markTokenAsUsed(token);
    
    // Log password reset completion
    const user = await db.getUserById(userId);
    if (user) {
      const { ipAddress, userAgent } = await getServerActionContext();
      await logSecurityEvent('password_reset_completed', {
        userId: user.id,
        tenantId: user.tenantId,
        details: { email: user.email },
        ipAddress,
        userAgent,
      });
    }
    
    return { success: true };
  } else {
    return { error: "Failed to reset password. Please try again." };
  }
}

const updateUserNameSchema = z.object({
    name: z.string().min(1, "Name cannot be empty.").max(100, "Name is too long."),
});

export async function updateUserNameAction(userId: string, formData: FormData): Promise<{ success?: boolean; error?: string; user?: User }> {
    if (!userId) return { error: "User not authenticated." };

    const name = formData.get('name') as string;
    const validatedFields = updateUserNameSchema.safeParse({ name });

    if (!validatedFields.success) {
        return { error: validatedFields.error.flatten().fieldErrors.name?.join(", ") };
    }

    const success = await db.updateUserNameDb(userId, validatedFields.data.name);
    if (success) {
        const updatedUser = await db.getUserById(userId);
        revalidatePath('/dashboard/profile');
        return { success: true, user: updatedUser || undefined };
    }
    return { error: "Failed to update name." };
}

const updateUserEmailSchema = z.object({
  email: z.string().email("Invalid email address.").max(255, "Email is too long."),
});

export async function updateUserEmailAction(userId: string, formData: FormData): Promise<{ success?: boolean; error?: string; user?: User }> {
    if (!userId) return { error: "User not authenticated." };

    const email = formData.get('email') as string;
    const validatedFields = updateUserEmailSchema.safeParse({ email });

    if (!validatedFields.success) {
        return { error: validatedFields.error.flatten().fieldErrors.email?.join(", ") };
    }

    const result = await db.updateUserEmailDb(userId, validatedFields.data.email);
    if (result.success) {
        const updatedUser = await db.getUserById(userId);
        revalidatePath('/dashboard/profile');
        return { success: true, user: updatedUser || undefined };
    }
    return { error: result.error || "Failed to update email." };
}


const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
}).refine(data => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
});


export async function changePasswordAction(userId: string, formData: FormData): Promise<{ success?: boolean; error?: string }> {
    if (!userId) return { error: "User not authenticated." };

    const data = Object.fromEntries(formData.entries());
    const validatedFields = changePasswordSchema.safeParse(data);

    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        return { error: fieldErrors.currentPassword?.[0] || fieldErrors.newPassword?.[0] || "Invalid input." };
    }
    
    const { currentPassword, newPassword } = validatedFields.data;

    const user = await db.getUserByEmail((await db.getUserById(userId))!.email); // Fetch full user for hashedPassword
    if (!user || !user.hashedPassword) {
        return { error: "User not found." };
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!passwordMatch) {
        return { error: "Incorrect current password." };
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    const updateSuccess = await db.updateUserPassword(userId, newHashedPassword);

    if (updateSuccess) {
        // Log password change
        const { ipAddress, userAgent } = await getServerActionContext();
        await logSecurityEvent('password_changed', {
            userId: userId,
            tenantId: user.tenantId,
            details: { email: user.email },
            ipAddress,
            userAgent,
        });
        
        revalidatePath('/dashboard/profile');
        return { success: true };
    }
    return { error: "Failed to change password." };
}

const verify2FASchema = z.object({
  code: z.string().min(1, "Code is required."),
});

export async function verify2FAAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const validatedFields = verify2FASchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { error: "Invalid verification code format." };
  }

  const { code } = validatedFields.data;

  // Get pending 2FA session
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const pending2FAData = cookieStore.get('pending-2fa')?.value;

  if (!pending2FAData) {
    return { error: "No pending 2FA verification. Please log in again." };
  }

  let pendingSession: { userId: string; token: string; expiresAt: number };
  try {
    pendingSession = JSON.parse(pending2FAData);
  } catch {
    return { error: "Invalid session data." };
  }

  // Check if session expired
  if (Date.now() > pendingSession.expiresAt) {
    cookieStore.delete('pending-2fa');
    return { error: "Verification session expired. Please log in again." };
  }

  // Verify the 2FA code
  const { verifyUserTwoFactor } = await import('@/lib/two-factor');
  const result = await verifyUserTwoFactor(pendingSession.userId, code);

  if (!result.success) {
    return { error: "Invalid verification code. Please try again." };
  }

  // Clear pending 2FA cookie
  cookieStore.delete('pending-2fa');

  // Get user and set auth cookie
  const user = await db.getUserById(pendingSession.userId);
  if (!user) {
    return { error: "User not found." };
  }

  const { hashedPassword, ...userToReturn } = user;
  const { ipAddress, userAgent } = await getServerActionContext();
  await setAuthCookie(userToReturn as User, ipAddress, userAgent);

  return { success: true };
}
