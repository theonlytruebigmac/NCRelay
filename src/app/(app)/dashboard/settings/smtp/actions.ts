
'use server';

import { z } from 'zod';
import * as db from '@/lib/db';
import type { SmtpSettings } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';
import { cookies } from 'next/headers';

/**
 * Get the current tenant ID from cookies
 * For SMTP config, we use tenant-scoped settings when available
 */
async function getCurrentTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('currentTenantId')?.value || null;
}

/**
 * Get SMTP settings for the current tenant, or null if not configured
 * System admins accessing without a tenant context should use the global admin page
 */
export async function getSmtpSettingsAction(): Promise<SmtpSettings | null> {
  const tenantId = await getCurrentTenantId();
  // Get tenant-specific settings (no fallback to global from tenant page)
  return db.getSmtpSettings(tenantId, false);
}

/**
 * Test SMTP settings before saving
 * Can be used from tenant-specific or global SMTP config pages
 */
export async function testSmtpSettingsAction(formData: FormData): Promise<{ success: boolean; message: string }> {
  const smtpSettingsSchema = z.object({
    host: z.string().min(1, "Host cannot be empty."),
    port: z.coerce.number().int().min(1, "Port must be a positive integer.").max(65535),
    user: z.string().min(1, "User cannot be empty."),
    password: z.string().optional(),
    secure: z.boolean().default(false),
    fromEmail: z.string().email("Invalid 'From Email' address."),
    testEmail: z.string().email("Invalid test recipient email address."),
  });

  const data = Object.fromEntries(formData.entries());
  
  // Convert port to number and secure to boolean
  const parsedData = {
    ...data,
    port: data.port ? parseInt(data.port as string, 10) : undefined,
    secure: data.secure === 'on' || data.secure === 'true',
  };

  const validatedFields = smtpSettingsSchema.safeParse(parsedData);

  if (!validatedFields.success) {
    return {
      success: false,
      message: "Invalid SMTP configuration. Please check all fields.",
    };
  }

  try {
    const { testEmail, ...smtpConfig } = validatedFields.data;
    const tenantId = await getCurrentTenantId();
    
    // Create a transporter with the provided settings
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password || '',
      },
    });

    // Send a test email
    const mailOptions = {
      from: smtpConfig.fromEmail,
      to: testEmail,
      subject: `NCRelay - SMTP Test${tenantId ? ' (Tenant Configuration)' : ' (Global Configuration)'}`,
      text: 'This is a test email from NCRelay. If you received this, your SMTP settings are configured correctly.',
      html: '<p>This is a test email from NCRelay.</p><p>If you received this, your SMTP settings are configured correctly.</p>',
    };

    // Verify the connection first
    await transporter.verify();
    
    // Then send the test email
    await transporter.sendMail(mailOptions);
    
    return { 
      success: true, 
      message: `SMTP connection successful! A test email has been sent to ${testEmail}.` 
    };
  } catch (error) {
    console.error("Failed to test SMTP settings:", error);
    return { 
      success: false, 
      message: `SMTP test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Save SMTP settings for the current tenant
 * Tenant admins save to their tenant, system admins should use global admin page
 */
export async function saveSmtpSettingsAction(formData: FormData): Promise<{ success: boolean; errors?: z.ZodIssue[]; message?: string }> {
  const smtpSettingsSchema = z.object({
    host: z.string().min(1, "Host cannot be empty."),
    port: z.coerce.number().int().min(1, "Port must be a positive integer.").max(65535),
    user: z.string().min(1, "User cannot be empty."),
    password: z.string().optional(),
    secure: z.boolean().default(false),
    fromEmail: z.string().email("Invalid 'From Email' address."),
    appBaseUrl: z.string().url("App Base URL must be a valid URL (e.g., http://localhost:9002 or https://yourdomain.com)."),
  });

  const data = Object.fromEntries(formData.entries());
  
  // Convert port to number and secure to boolean
  const parsedData = {
    ...data,
    port: data.port ? parseInt(data.port as string, 10) : undefined,
    secure: data.secure === 'on' || data.secure === 'true',
  };

  const validatedFields = smtpSettingsSchema.safeParse(parsedData);

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.issues,
    };
  }

  try {
    const tenantId = await getCurrentTenantId();
    
    const settingsToSave: SmtpSettings = {
      id: tenantId ? `smtp_${tenantId}` : 'default_settings',
      ...validatedFields.data,
      password: validatedFields.data.password || '',
      tenantId: tenantId
    };
    
    await db.saveSmtpSettings(settingsToSave);
    revalidatePath('/dashboard/settings/smtp');
    
    return { 
      success: true, 
      message: tenantId 
        ? "Tenant SMTP settings saved successfully." 
        : "Global SMTP settings saved successfully." 
    };
  } catch (error) {
    console.error("Failed to save SMTP settings:", error);
    return { success: false, message: "Failed to save SMTP settings due to a server error." };
  }
}
