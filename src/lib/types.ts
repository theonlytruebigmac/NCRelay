import { z } from 'zod';

export const LoggingSettingsSchema = z.object({
  logRetentionDays: z.coerce.number().int().min(1).max(365),
  loggingEnabled: z.boolean(),
  logWebhookRequests: z.boolean(),
  logApiRequests: z.boolean()
});

export type LoggingSettings = z.infer<typeof LoggingSettingsSchema>;

export type Platform = 'slack' | 'discord' | 'teams' | 'generic_webhook';

export interface Integration {
  id: string;
  name: string;
  platform: Platform;
  webhookUrl: string;
  enabled: boolean;
  fieldFilterId?: string; // New field to reference the field filter configuration
  userId?: string; // User who created this integration
}

export interface User {
  id: string;
  email: string;
  name?: string;
  isAdmin?: boolean;
  provider?: 'local' | 'google'; // OAuth provider type
  providerId?: string; // OAuth provider's user ID
  providerAccountId?: string; // OAuth account ID for linking
  // hashedPassword is not sent to client
}

export interface ApiEndpointConfig {
  id: string;
  name: string; 
  path: string; // This will now be a secure UUID instead of user-defined
  associatedIntegrationIds: string[]; 
  createdAt: string;
  ipWhitelist?: string[]; // IP addresses allowed to access this specific endpoint
  tenantId?: string; // The tenant this endpoint belongs to
}

export interface LoggedIntegrationAttempt {
  integrationId: string;
  integrationName: string;
  platform: Platform;
  status: 'success' | 'failed_transformation' | 'failed_relay' | 'skipped_disabled' | 'skipped_no_association';
  webhookUrl: string;
  errorDetails?: string;
  outgoingPayload?: string; 
  responseStatus?: number;
  responseBody?: string; 
}

export interface SecuritySettings {
  id: string; // Should be a fixed value like 'default_security_settings'
  rateLimitMaxRequests: number; // Requests per window
  rateLimitWindowMs: number; // Time window in milliseconds
  maxPayloadSize: number; // In bytes
  logRetentionDays: number; // How long to keep logs
  apiRateLimitEnabled: boolean; // Whether rate limiting is enabled
  webhookRateLimitEnabled: boolean; // Whether rate limiting is enabled for webhook calls
  ipWhitelist: string[]; // List of IPs that bypass rate limiting
  enableDetailedErrorLogs: boolean; // Whether to include detailed error info in logs
}

export interface LogEntry {
  id: string; 
  timestamp: string; 
  apiEndpointId: string;
  apiEndpointName: string;
  apiEndpointPath: string;
  fieldFilterId?: string;
  userId?: string;
  incomingRequest: {
    ip?: string | null;
    method: string;
    headers: Record<string, string>;
    bodyRaw: string; 
  };
  processingSummary: {
    overallStatus: 'success' | 'partial_failure' | 'total_failure' | 'no_integrations_triggered';
    message: string; 
  };
  integrations: LoggedIntegrationAttempt[];
}

export interface SmtpSettings {
  id: string; // Should be a fixed value like 'default_settings' for global, or tenant-specific ID
  host: string;
  port: number;
  user: string;
  password?: string; // Will be encrypted in DB, decrypted for use
  secure: boolean;
  fromEmail: string;
  appBaseUrl: string; // For constructing links in emails
  tenantId?: string | null; // NULL = global/system SMTP, non-NULL = tenant-specific SMTP
}

// New interface for the field filter approach
export interface FieldFilterConfig {
  id: string;
  name: string;
  includedFields: string[]; // List of fields to include
  excludedFields: string[]; // List of fields to explicitly exclude
  description?: string;
  createdAt: string;
  updatedAt: string;
  sampleData?: string; // Sample data used to create this filter
}

export interface TemplateMapping {
  id: string;
  platform: Platform;
  template: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type DigestFrequency = 'never' | 'daily' | 'weekly' | 'monthly';

export interface NotificationPreferences {
    userId: string;
    emailNotifications: boolean;
    systemNotifications: boolean;
    importantOnly: boolean;
    failureNotificationsOnly: boolean;
    emailDigestFrequency: DigestFrequency;
    createdAt: string;
    updatedAt: string;
}

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueuedNotification {
    id: string;
    status: QueueStatus;
    priority: number;
    maxRetries: number;
    retryCount: number;
    nextRetryAt: string | null;
    createdAt: string;
    updatedAt: string;
    lastAttemptAt: string | null;
    integrationId: string;
    integrationName: string;
    platform: Platform;
    webhookUrl: string;
    payload: string;
    contentType: string;
    errorDetails?: string;
    responseStatus?: number;
    responseBody?: string;
    apiEndpointId: string;
    apiEndpointName: string;
    apiEndpointPath: string;
    originalRequestId: string;
}

// Multi-tenancy types
export type TenantPlan = 'free' | 'pro' | 'enterprise';
export type TenantUserRole = 'owner' | 'admin' | 'billing_admin' | 'integration_manager' | 'endpoint_manager' | 'developer' | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  plan: TenantPlan;
  maxEndpoints: number;
  maxIntegrations: number;
  maxRequestsPerMonth: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantUserRole;
  createdAt: string;
  updatedAt: string;
}

export interface TenantWithRole extends Tenant {
  userRole: TenantUserRole;
}

// RBAC types
export type Resource = 
  | 'tenant'
  | 'users'
  | 'endpoints'
  | 'integrations'
  | 'logs'
  | 'webhooks'
  | 'analytics'
  | 'billing'
  | 'settings'
  | 'field_filters'
  | 'templates';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'test' | 'manage';

export interface Permission {
  resource: Resource;
  action: Action;
  allowed: boolean;
}

export interface RolePermission {
  id: string;
  tenantId: string;
  role: TenantUserRole;
  resource: Resource;
  action: Action;
  allowed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: Resource;
  resourceId?: string;
  changes?: string;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure' | 'denied';
  reason?: string;
  timestamp: string;
}

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}
