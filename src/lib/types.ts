
export type Platform = 'slack' | 'discord' | 'teams' | 'generic_webhook';

export interface Integration {
  id: string;
  name: string;
  platform: Platform;
  webhookUrl: string;
  enabled: boolean;
  targetFormat: 'json' | 'xml' | 'text';
}

export interface User {
  id: string;
  email: string;
  name?: string;
  isAdmin?: boolean;
  // hashedPassword is not sent to client
}

export interface ApiEndpointConfig {
  id: string;
  name: string; 
  path: string; 
  associatedIntegrationIds: string[]; 
  createdAt: string; 
}

export interface LoggedIntegrationAttempt {
  integrationId: string;
  integrationName: string;
  platform: Platform;
  status: 'success' | 'failed_transformation' | 'failed_relay' | 'skipped_disabled' | 'skipped_no_association';
  targetFormat: 'json' | 'xml' | 'text';
  webhookUrl: string;
  errorDetails?: string;
  outgoingPayload?: string; 
  responseStatus?: number;
  responseBody?: string; 
}

export interface LogEntry {
  id: string; 
  timestamp: string; 
  apiEndpointId: string;
  apiEndpointName: string;
  apiEndpointPath: string;
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
  id: string; // Should be a fixed value like 'default_settings'
  host: string;
  port: number;
  user: string;
  password?: string; // Will be encrypted in DB, decrypted for use
  secure: boolean;
  fromEmail: string;
  appBaseUrl: string; // For constructing links in emails
}
