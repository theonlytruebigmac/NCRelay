
'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import * as db from '@/lib/db';
import type { User } from '@/lib/types';
import { sendPasswordResetEmail } from '@/lib/email';
import { revalidatePath } from 'next/cache';
import { setAuthCookie, removeAuthCookie } from '@/lib/auth';
import { redirect } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password cannot be empty."), // Min 1 for presence, actual length check is on hashing
});

export async function loginAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const validatedFields = loginSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { error: "Invalid email or password format." };
  }

  const { email, password } = validatedFields.data;

  const existingUser = await db.getUserByEmail(email);

  if (!existingUser || !existingUser.hashedPassword) {
    return { error: "Invalid email or password." };
  }

  const passwordMatch = await bcrypt.compare(password, existingUser.hashedPassword);

  if (!passwordMatch) {
    return { error: "Invalid email or password." };
  }
  
  const { hashedPassword, ...userToReturn } = existingUser;
  
  // Set authentication cookie
  await setAuthCookie(userToReturn as User);
  
  return { success: true };
}

export async function logoutAction(): Promise<void> {
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
    const token = await db.createPasswordResetToken(user.id);
    await sendPasswordResetEmail(user.email, token);
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

  const tokenData = await db.getPasswordResetToken(token);

  if (!tokenData) {
    return { error: "Invalid or expired password reset token." };
  }

  if (new Date(tokenData.expiresAt) < new Date()) {
    await db.deletePasswordResetToken(token); // Clean up expired token
    return { error: "Password reset token has expired." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const success = await db.updateUserPassword(tokenData.userId, hashedPassword);

  if (success) {
    await db.deletePasswordResetToken(token); // Token used, delete it
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
        revalidatePath('/dashboard/profile');
        return { success: true };
    }
    return { error: "Failed to change password." };
}
