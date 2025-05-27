
'use server';

import { z } from 'zod';
import * as db from '@/lib/db';
import type { SmtpSettings } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// smtpSettingsSchema is now defined inside saveSmtpSettingsAction

export async function getSmtpSettingsAction(): Promise<SmtpSettings | null> {
  return db.getSmtpSettings();
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
    secure: data.secure === 'on' || data.secure === 'true' || data.secure === true,
  };

  const validatedFields = smtpSettingsSchema.safeParse(parsedData);

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.errors,
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
