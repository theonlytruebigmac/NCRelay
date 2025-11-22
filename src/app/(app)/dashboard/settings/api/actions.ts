
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as db from '@/lib/db';
import type { ApiEndpointConfig } from '@/lib/types';

const apiEndpointSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters.").max(50, "Name must be at most 50 characters."),
  associatedIntegrationIds: z.array(z.string()),
  ipWhitelist: z.array(z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address')).optional(),
});

export async function getApiEndpointsAction(): Promise<ApiEndpointConfig[]> {
  const endpoints = await db.getApiEndpoints(); 
  return endpoints.map(ep => ({ 
    ...ep,
    // associatedIntegrationIds is already parsed in db.ts
  }));
}

export async function getIntegrationsForEndpointSelectionAction() {
    const integrations = await db.getIntegrations(); 
    return integrations.map(int => ({ id: int.id, name: int.name, platform: int.platform, enabled: int.enabled }));
}


export async function addApiEndpointAction(formData: FormData) {
  const name = formData.get('name') as string;
  const associatedIntegrationIds = formData.getAll('associatedIntegrationIds[]') as string[];
  const ipWhitelist = formData.getAll('ipWhitelist[]') as string[];

  const validatedFields = apiEndpointSchema.safeParse({
    name,
    associatedIntegrationIds,
    ipWhitelist,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  try {
    await db.addApiEndpoint(validatedFields.data);
    revalidatePath('/dashboard/settings/api');
    return { success: true };
  } catch (error) {
    console.error("Failed to add API endpoint:", error);
    return { error: "Failed to add API endpoint." };
  }
}

export async function updateApiEndpointAction(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  const associatedIntegrationIds = formData.getAll('associatedIntegrationIds[]') as string[];
  const ipWhitelist = formData.getAll('ipWhitelist[]') as string[];

  const validatedFields = apiEndpointSchema.safeParse({
    name,
    associatedIntegrationIds,
    ipWhitelist,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  try {
    const result = await db.updateApiEndpoint(id, validatedFields.data);
     if (!result) {
        return { error: "API Endpoint not found." };
    }
    revalidatePath('/dashboard/settings/api');
    return { success: true };
  } catch (error) {
    console.error("Failed to update API endpoint:", error);
    return { error: "Failed to update API endpoint." };
  }
}

export async function deleteApiEndpointAction(id: string) {
  try {
    const success = await db.deleteApiEndpoint(id);
    if(!success) {
        return { error: "API Endpoint not found or already deleted."};
    }
    revalidatePath('/dashboard/settings/api');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete API endpoint:", error);
    return { error: "Failed to delete API endpoint." };
  }
}

    