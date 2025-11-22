
'use server';

import { z } from 'zod';
import * as db from '@/lib/db';
import type { SmtpSettings } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';

// smtpSettingsSchema is now defined inside saveSmtpSettingsAction

export async function getSmtpSettingsAction(): Promise<SmtpSettings | null> {
  return db.getSmtpSettings();
}

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
      subject: 'NCRelay - SMTP Test',
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

export async function saveSmtpSettingsAction(formData: FormData): Promise<{ success: boolean; errors?: z.ZodIssue[]; message?: string }> {
  // Define the schema inside the function
  const smtpSettingsSchema = z.object({
    host: z.string().min(1, "Host cannot be empty."),
    port: z.coerce.number().int().min(1, "Port must be a positive integer.").max(65535),
    user: z.string().min(1, "User cannot be empty."),
    password: z.string().optional(), // Password can be optional for some SMTP setups
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
    const settingsToSave: SmtpSettings = {
      id: 'default_settings', // Fixed ID for single config
      ...validatedFields.data,
      password: validatedFields.data.password || '', // Ensure password is a string
    };
    await db.saveSmtpSettings(settingsToSave);
    revalidatePath('/dashboard/settings'); // Revalidate the main settings page
    return { success: true, message: "SMTP settings saved successfully." };
  } catch (error) {
    console.error("Failed to save SMTP settings:", error);
    return { success: false, message: "Failed to save SMTP settings due to a server error." };
  }
}
