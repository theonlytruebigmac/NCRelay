'use server';

import { z } from 'zod';
import * as db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

const createTenantSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100, "Name is too long"),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug is too long")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
});

export async function createTenantAndCompleteOnboarding(
  userId: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string; tenantId?: string }> {
  try {
    if (!userId) {
      return { error: "User not authenticated" };
    }

    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;

    const validatedFields = createTenantSchema.safeParse({ name, slug });

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      return { error: errors.name?.[0] || errors.slug?.[0] || "Invalid input" };
    }

    const database = await db.getDB();

    // Check if slug is already taken
    const existingTenant = database.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
    if (existingTenant) {
      return { error: "This organization URL is already taken. Please choose another." };
    }

    // Create the tenant
    const tenantId = uuidv4();
    const now = new Date().toISOString();

    database.prepare(`
      INSERT INTO tenants (id, name, slug, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(tenantId, validatedFields.data.name, validatedFields.data.slug, now, now);

    // Add user to tenant as owner/admin
    database.prepare(`
      INSERT INTO tenant_users (tenantId, userId, role, createdAt, updatedAt)
      VALUES (?, ?, 'owner', ?, ?)
    `).run(tenantId, userId, now, now);

    // Mark onboarding as complete
    database.prepare(`
      UPDATE users SET onboardingCompleted = 1, updatedAt = ? WHERE id = ?
    `).run(now, userId);

    console.log(`✅ User ${userId} completed onboarding and created tenant ${tenantId}`);

    revalidatePath('/onboarding');
    revalidatePath('/dashboard');

    return { success: true, tenantId };
  } catch (error) {
    console.error('Error creating tenant during onboarding:', error);
    return { error: "Failed to create organization. Please try again." };
  }
}

export async function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  try {
    const database = await db.getDB();
    const existingTenant = database.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
    return { available: !existingTenant };
  } catch (error) {
    console.error('Error checking slug availability:', error);
    return { available: false };
  }
}
