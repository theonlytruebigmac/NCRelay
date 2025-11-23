"use server";

import { revalidatePath } from "next/cache";
import { createFieldFilter, updateFieldFilter, deleteFieldFilter, getFieldFilters, getFieldFilter } from "@/lib/field-filter-db";
import { getCurrentUser } from "@/lib/auth";
import { getRequestLogs } from "@/lib/db";
import type { FieldFilterConfig } from "@/lib/types";
import { cookies } from 'next/headers';

async function getCurrentTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get('currentTenantId');
  return tenantCookie?.value || null;
}

/**
 * Get all field filters
 */
export async function getFieldFiltersAction(): Promise<FieldFilterConfig[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const tenantId = await getCurrentTenantId();
  return tenantId ? getFieldFilters(tenantId) : getFieldFilters();
}

/**
 * Get a field filter by ID
 */
export async function getFieldFilterByIdAction(id: string): Promise<FieldFilterConfig | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  return getFieldFilter(id);
}

/**
 * Create a new field filter
 */
export async function createFieldFilterAction(
  data: Omit<FieldFilterConfig, "id" | "createdAt" | "updatedAt">
): Promise<FieldFilterConfig> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const tenantId = await getCurrentTenantId();
  const filter = await createFieldFilter(data, tenantId || undefined);
  revalidatePath("/dashboard/filters");
  return filter;
}

/**
 * Update a field filter
 */
export async function updateFieldFilterAction(
  id: string,
  data: Partial<Omit<FieldFilterConfig, "id" | "createdAt" | "updatedAt">>
): Promise<FieldFilterConfig | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const filter = await updateFieldFilter(id, data);
  revalidatePath("/dashboard/filters");
  return filter;
}

/**
 * Delete a field filter
 */
export async function deleteFieldFilterAction(id: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const result = await deleteFieldFilter(id);
  revalidatePath("/dashboard/filters");
  return result;
}

/**
 * Get log data for sample loading in field filter forms
 */
export async function getLogSamplesAction(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const tenantId = await getCurrentTenantId();
  const logs = tenantId ? await getRequestLogs(tenantId) : await getRequestLogs();
  return logs
    .map(log => log.incomingRequest.bodyRaw)
    .filter(body => body && body.trim().length > 0)
    .slice(0, 10); // Limit to 10 most recent samples
}
