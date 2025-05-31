'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import type { Integration } from '@/lib/types';

const integrationSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }).max(50),
  platform: z.enum(['slack', 'discord', 'teams', 'generic_webhook']),
  webhookUrl: z.string().url({ message: "Invalid webhook URL." }),
  enabled: z.boolean().default(true),
  fieldFilterId: z.string().optional(),
});

export async function getIntegrationsAction(): Promise<Integration[]> {
  return db.getIntegrations();
}

export async function getIntegrationByIdAction(id: string): Promise<Integration | null> {
  return db.getIntegrationById(id);
}

export async function addIntegrationAction(formData: FormData) {
  // Get current authenticated user
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Authentication required." };
  }

  const data = Object.fromEntries(formData.entries());
  // Convert 'enabled' from string 'on'/'off' or value to boolean
  const enabledValue = data.enabled === 'on' || data.enabled === 'true';

  // Handle fieldFilterId - undefined if not present or 'none'
  const fieldFilterId = data.fieldFilterId && data.fieldFilterId !== 'none'
    ? data.fieldFilterId as string
    : undefined;

  const validatedFields = integrationSchema.safeParse({
    name: data.name,
    platform: data.platform,
    webhookUrl: data.webhookUrl,
    enabled: enabledValue,
    fieldFilterId,
  });

  if (!validatedFields.success) {
    console.error('Add Integration Validation Error:', validatedFields.error.flatten().fieldErrors);
    // Consider returning error messages to the client
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    await db.addIntegration(validatedFields.data, user.id);
    revalidatePath('/dashboard/integrations');
    return { success: true };
  } catch (error) {
    console.error("Failed to add integration:", error);
    return { error: "Failed to add integration." };
  }
}

export async function updateIntegrationAction(id: string, formData: FormData) {
  // Get current authenticated user
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Authentication required." };
  }

  const data = Object.fromEntries(formData.entries());
  const enabledValue = data.enabled === 'on' || data.enabled === 'true';
  
  // Handle fieldFilterId - undefined if not present or 'none'
  const fieldFilterId = data.fieldFilterId && data.fieldFilterId !== 'none'
    ? data.fieldFilterId as string
    : undefined;
  
  const validatedFields = integrationSchema.safeParse({
    name: data.name,
    platform: data.platform,
    webhookUrl: data.webhookUrl,
    enabled: enabledValue,
    fieldFilterId,
  });

  if (!validatedFields.success) {
     console.error('Update Integration Validation Error:', validatedFields.error.flatten().fieldErrors);
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  try {
    const result = await db.updateIntegration(id, validatedFields.data);
    if (!result) {
        return { error: "Integration not found." };
    }
    revalidatePath('/dashboard/integrations');
    revalidatePath(`/dashboard/integrations/${id}/edit`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update integration:", error);
    return { error: "Failed to update integration." };
  }
}

export async function deleteIntegrationAction(id: string) {
  // Get current authenticated user
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Authentication required." };
  }

  try {
    const success = await db.deleteIntegration(id);
    if (!success) {
      return { error: "Integration not found or already deleted." };
    }
    revalidatePath('/dashboard/integrations');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete integration:", error);
    return { error: "Failed to delete integration." };
  }
}

export async function toggleIntegrationEnabledAction(id: string, enabled: boolean) {
  // Get current authenticated user
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Authentication required." };
  }

  try {
    const integration = await db.getIntegrationById(id);
    if (!integration) {
      return { error: "Integration not found." };
    }
    await db.updateIntegration(id, { ...integration, enabled });
    revalidatePath('/dashboard/integrations');
    return { success: true, enabled };
  } catch (error) {
    console.error("Failed to toggle integration:", error);
    return { error: "Failed to toggle integration status." };
  }
}

