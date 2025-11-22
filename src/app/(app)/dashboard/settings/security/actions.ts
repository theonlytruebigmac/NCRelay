"use server";

import { cookies } from "next/headers";
import { verifyAuthToken } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getUserByEmail } from "@/lib/db";
import Database from 'better-sqlite3';
import { z } from "zod";
import { SecuritySettings, User } from "@/lib/types";

// Database helper function
function getDB() {
  const DB_PATH = process.env.NODE_ENV === 'production' ? '/data/app.db' : 'app.db';
  return new Database(DB_PATH);
}

// Schema for validating security settings
const securitySettingsSchema = z.object({
  id: z.string(),
  rateLimitMaxRequests: z.number().int().min(1).max(10000),
  rateLimitWindowMs: z.number().int().min(1000).max(3600000),
  maxPayloadSize: z.number().int().min(1024).max(100 * 1024 * 1024), // 1KB to 100MB
  logRetentionDays: z.number().int().min(1).max(365), // 1 day to 1 year
  apiRateLimitEnabled: z.boolean(),
  webhookRateLimitEnabled: z.boolean(),
  ipWhitelist: z.array(z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address')),
  enableDetailedErrorLogs: z.boolean(),
});

// Helper function to check admin authentication
async function checkAdminAuth(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('ncrelay-auth-token')?.value;
  
  if (!token) {
    return null;
  }
  
  const payload = verifyAuthToken(token);
  if (!payload) {
    return null;
  }
  
  const user = await getUserByEmail(payload.email);
  if (!user?.isAdmin) {
    return null;
  }
  
  return user;
}

// Get the current security settings
export async function getSecuritySettingsAction(): Promise<SecuritySettings> {
  const user = await checkAdminAuth();
  if (!user) {
    throw new Error("Unauthorized access");
  }

  const db = getDB();

  // Try to get existing settings
  const existingSettings = db.prepare(`
    SELECT * FROM security_settings WHERE id = ?
  `).get('default_security_settings') as Record<string, unknown> | undefined;

  if (!existingSettings) {
    // Get values from environment or use defaults
    const defaultSettings: SecuritySettings = {
      id: 'default_security_settings',
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), 
      maxPayloadSize: parseInt(process.env.MAX_PAYLOAD_SIZE || '10485760'), // 10MB default
      logRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
      apiRateLimitEnabled: true,
      webhookRateLimitEnabled: false,
      ipWhitelist: [],
      enableDetailedErrorLogs: false,
    };

    // Create settings if they don't exist yet
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS security_settings (
          id TEXT PRIMARY KEY,
          rateLimitMaxRequests INTEGER NOT NULL,
          rateLimitWindowMs INTEGER NOT NULL,
          maxPayloadSize INTEGER NOT NULL,
          logRetentionDays INTEGER NOT NULL,
          apiRateLimitEnabled INTEGER NOT NULL,
          webhookRateLimitEnabled INTEGER NOT NULL,
          ipWhitelist TEXT NOT NULL,
          enableDetailedErrorLogs INTEGER NOT NULL
        )
      `).run();

      db.prepare(`
        INSERT INTO security_settings 
        (id, rateLimitMaxRequests, rateLimitWindowMs, maxPayloadSize, logRetentionDays, 
         apiRateLimitEnabled, webhookRateLimitEnabled, ipWhitelist, enableDetailedErrorLogs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        defaultSettings.id,
        defaultSettings.rateLimitMaxRequests,
        defaultSettings.rateLimitWindowMs,
        defaultSettings.maxPayloadSize,
        defaultSettings.logRetentionDays,
        defaultSettings.apiRateLimitEnabled ? 1 : 0,
        defaultSettings.webhookRateLimitEnabled ? 1 : 0,
        JSON.stringify(defaultSettings.ipWhitelist),
        defaultSettings.enableDetailedErrorLogs ? 1 : 0
      );

      return defaultSettings;
    } catch (error) {
      console.error("Failed to create security settings:", error);
      throw new Error("Failed to create security settings");
    }
  }

  // Convert from SQLite format to our type
  return {
    id: existingSettings.id as string,
    rateLimitMaxRequests: existingSettings.rateLimitMaxRequests as number,
    rateLimitWindowMs: existingSettings.rateLimitWindowMs as number,
    maxPayloadSize: existingSettings.maxPayloadSize as number,
    logRetentionDays: existingSettings.logRetentionDays as number,
    apiRateLimitEnabled: !!existingSettings.apiRateLimitEnabled,
    webhookRateLimitEnabled: !!existingSettings.webhookRateLimitEnabled,
    ipWhitelist: JSON.parse(existingSettings.ipWhitelist as string || '[]'),
    enableDetailedErrorLogs: !!existingSettings.enableDetailedErrorLogs,
  };
}

// Update security settings
export async function updateSecuritySettingsAction(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
  const user = await checkAdminAuth();
  if (!user) {
    throw new Error("Unauthorized access");
  }

  // Get current settings to merge with updates
  const currentSettings = await getSecuritySettingsAction();
  const mergedSettings = { ...currentSettings, ...settings };

  try {
    // Validate settings
    securitySettingsSchema.parse(mergedSettings);
  } catch (error) {
    console.error("Invalid security settings:", error);
    throw new Error("Invalid security settings");
  }

  try {
    const db = getDB();
    db.prepare(`
      UPDATE security_settings SET
        rateLimitMaxRequests = ?,
        rateLimitWindowMs = ?,
        maxPayloadSize = ?,
        logRetentionDays = ?,
        apiRateLimitEnabled = ?,
        webhookRateLimitEnabled = ?,
        ipWhitelist = ?,
        enableDetailedErrorLogs = ?
      WHERE id = ?
    `).run(
      mergedSettings.rateLimitMaxRequests,
      mergedSettings.rateLimitWindowMs,
      mergedSettings.maxPayloadSize,
      mergedSettings.logRetentionDays,
      mergedSettings.apiRateLimitEnabled ? 1 : 0,
      mergedSettings.webhookRateLimitEnabled ? 1 : 0,
      JSON.stringify(mergedSettings.ipWhitelist),
      mergedSettings.enableDetailedErrorLogs ? 1 : 0,
      'default_security_settings'
    );

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/security");
    
    return mergedSettings;
  } catch (error) {
    console.error("Failed to update security settings:", error);
    throw new Error("Failed to update security settings");
  }
}
