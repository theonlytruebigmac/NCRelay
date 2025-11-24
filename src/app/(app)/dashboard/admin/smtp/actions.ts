'use server';

import { z } from 'zod';
import * as db from '@/lib/db';
import type { SmtpSettings } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';
import { isAdmin } from '@/lib/auth';

/**
 * Get global SMTP settings (for system alerts and SaaS metrics)
 * Only accessible by system administrators
 */
export async function getGlobalSmtpSettingsAction(): Promise<SmtpSettings | null> {
  const admin = await isAdmin();
  if (!admin) {
    throw new Error('Unauthorized: Only system administrators can access global SMTP settings');
  }
  
  // Get global settings (tenantId = null)
  return db.getSmtpSettings(null, false);
}

/**
 * Test global SMTP settings
 * Only accessible by system administrators
 */
export async function testGlobalSmtpSettingsAction(formData: FormData): Promise<{ success: boolean; message: string }> {
  const admin = await isAdmin();
  if (!admin) {
    return {
      success: false,
      message: 'Unauthorized: Only system administrators can test global SMTP settings'
    };
  }
  
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
    
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password || '',
      },
    });

    const mailOptions = {
      from: smtpConfig.fromEmail,
      to: testEmail,
      subject: 'NCRelay - Global SMTP Test (System Configuration)',
      text: 'This is a test email from NCRelay global SMTP configuration. If you received this, your system-wide SMTP settings are configured correctly and will be used for SaaS metrics, alerts, and password resets.',
      html: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #4F46E5;">Global SMTP Configuration Test</h2><p>Your system-wide SMTP settings have been configured successfully!</p><p>This configuration will be used for:</p><ul><li>System alerts and monitoring</li><li>SaaS metrics and reports</li><li>Password reset emails</li><li>Fallback when tenant SMTP is not configured</li></ul><p style="color: #666; font-size: 14px; margin-top: 30px;">This is a test from the NCRelay global administrator configuration.</p></div>',
    };

    await transporter.verify();
    await transporter.sendMail(mailOptions);
    
    return { 
      success: true, 
      message: `Global SMTP connection successful! A test email has been sent to ${testEmail}.` 
    };
  } catch (error) {
    console.error("Failed to test global SMTP settings:", error);
    return { 
      success: false, 
      message: `Global SMTP test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Save global SMTP settings
 * Only accessible by system administrators
 */
export async function saveGlobalSmtpSettingsAction(formData: FormData): Promise<{ success: boolean; errors?: z.ZodIssue[]; message?: string }> {
  const admin = await isAdmin();
  if (!admin) {
    return {
      success: false,
      message: 'Unauthorized: Only system administrators can save global SMTP settings'
    };
  }
  
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
    const settingsToSave: SmtpSettings = {
      id: 'default_settings', // Global settings always use this ID
      ...validatedFields.data,
      password: validatedFields.data.password || '',
      tenantId: null // Explicitly null for global settings
    };
    
    await db.saveSmtpSettings(settingsToSave);
    revalidatePath('/dashboard/admin/smtp');
    
    return { 
      success: true, 
      message: "Global SMTP settings saved successfully. These will be used for system alerts, SaaS metrics, and as fallback." 
    };
  } catch (error) {
    console.error("Failed to save global SMTP settings:", error);
    return { success: false, message: "Failed to save global SMTP settings due to a server error." };
  }
}
