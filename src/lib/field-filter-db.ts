import { getDB } from './db';
import type { FieldFilterConfig } from './types';
import crypto from 'crypto';

/**
 * Create a new field filter configuration
 */
export async function createFieldFilter(data: Omit<FieldFilterConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<FieldFilterConfig> {
  const db = await getDB();
  
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  db.prepare(
    `INSERT INTO field_filters (
      id, name, included_fields, excluded_fields, description, sample_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.name,
    JSON.stringify(data.includedFields),
    JSON.stringify(data.excludedFields),
    data.description || null,
    data.sampleData || null,
    now,
    now
  );
  
  return {
    id,
    name: data.name,
    includedFields: data.includedFields,
    excludedFields: data.excludedFields,
    description: data.description,
    sampleData: data.sampleData,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Get a field filter by ID
 */
interface FieldFilterRow {
  id: string;
  name: string;
  included_fields: string;
  excluded_fields: string;
  description: string | null;
  sample_data: string | null;
  created_at: string;
  updated_at: string;
}

export async function getFieldFilter(id: string): Promise<FieldFilterConfig | null> {
  const db = await getDB();
  
  const stmt = db.prepare(`SELECT * FROM field_filters WHERE id = ?`);
  const row = stmt.get(id) as FieldFilterRow | undefined;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    includedFields: JSON.parse(row.included_fields),
    excludedFields: JSON.parse(row.excluded_fields),
    description: row.description ?? undefined,  // Convert null to undefined
    sampleData: row.sample_data ?? undefined,  // Convert null to undefined
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get all field filters
 */
export async function getFieldFilters(): Promise<FieldFilterConfig[]> {
  const db = await getDB();
  
  const stmt = db.prepare(`SELECT * FROM field_filters ORDER BY name ASC`);
  const rows = stmt.all() as FieldFilterRow[];
  
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    includedFields: JSON.parse(row.included_fields),
    excludedFields: JSON.parse(row.excluded_fields),
    description: row.description ?? undefined,  // Convert null to undefined
    sampleData: row.sample_data ?? undefined,  // Convert null to undefined
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Update a field filter
 */
export async function updateFieldFilter(
  id: string, 
  data: Partial<Omit<FieldFilterConfig, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<FieldFilterConfig | null> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  // Build update query dynamically based on provided fields
  const updates: string[] = ['updated_at = @now'];
  const params: Record<string, string | number | null> = { now };
  
  if (data.name !== undefined) {
    updates.push('name = @name');
    params.name = data.name;
  }
  
  if (data.includedFields !== undefined) {
    updates.push('included_fields = @includedFields');
    params.includedFields = JSON.stringify(data.includedFields);
  }
  
  if (data.excludedFields !== undefined) {
    updates.push('excluded_fields = @excludedFields');
    params.excludedFields = JSON.stringify(data.excludedFields);
  }
  
  if (data.description !== undefined) {
    updates.push('description = @description');
    params.description = data.description;
  }
  
  if (data.sampleData !== undefined) {
    updates.push('sample_data = @sampleData');
    params.sampleData = data.sampleData;
  }
  
  // Add ID to params
  params.id = id;
  
  db.prepare(
    `UPDATE field_filters SET ${updates.join(', ')} WHERE id = @id`
  ).run(params);
  
  return getFieldFilter(id);
}

/**
 * Delete a field filter
 */
export async function deleteFieldFilter(id: string): Promise<boolean> {
  const db = await getDB();
  
  // Remove any references in integrations
  db.prepare(
    `UPDATE integrations SET fieldFilterId = NULL WHERE fieldFilterId = ?`
  ).run(id);
  
  // Delete the filter
  const result = db.prepare(
    `DELETE FROM field_filters WHERE id = ?`
  ).run(id);
  
  return result.changes > 0;
}
