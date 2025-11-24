'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '@/lib/db';

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const validatedFields = registerSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    });

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      return { error: errors.name?.[0] || errors.email?.[0] || errors.password?.[0] || "Invalid input" };
    }

    const { name, email, password } = validatedFields.data;
    const db = await getDB();

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return { error: "An account with this email already exists" };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with onboarding not completed
    const userId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (
        id, email, name, hashedPassword, provider, isAdmin, onboardingCompleted, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, 'local', 0, 0, ?, ?)
    `).run(userId, email, name, hashedPassword, now, now);

    console.log(`✅ New user registered: ${email} - onboarding required`);

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: "Failed to create account. Please try again." };
  }
}
