'use client';

import { useState, useEffect } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SmtpSettingsForm } from '@/components/dashboard/settings/SmtpSettingsForm';
import { getGlobalSmtpSettingsAction, saveGlobalSmtpSettingsAction, testGlobalSmtpSettingsAction } from './actions';
import type { SmtpSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Server, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function GlobalSmtpSettingsPage() {
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSmtpSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getGlobalSmtpSettingsAction();
      setSmtpSettings(settings);
    } catch (error) {
      console.error('Failed to load global SMTP settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not load global SMTP settings.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSmtpSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSubmit = () => {
    fetchSmtpSettings();
  };

  return (
    <PageShell
      title="Global SMTP Configuration"
      description="System-wide email settings for SaaS metrics and alerts"
    >
      <div className="space-y-6">
        <Alert>
          <Server className="h-4 w-4" />
          <AlertTitle>System Administrator Configuration</AlertTitle>
          <AlertDescription>
            These global SMTP settings are used for:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>System-wide monitoring alerts and SaaS metrics</li>
              <li>Password reset emails for all users</li>
              <li>Fallback email delivery when tenant SMTP is not configured</li>
              <li>System notifications and administrative communications</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-950">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Tenant vs Global SMTP</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Global SMTP (this page):</strong> Used for system operations and as fallback.
            <br />
            <strong>Tenant SMTP:</strong> Each tenant can configure their own SMTP for tenant-specific notifications.
            Tenants can access their SMTP settings at Dashboard → Settings → SMTP Config.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Global Email Server Configuration
            </CardTitle>
            <CardDescription>
              Configure the system-wide SMTP server. All system alerts, password resets, and tenant
              fallback emails will use these settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SmtpSettingsForm 
                initialData={smtpSettings} 
                onFormSubmit={handleFormSubmit}
                saveAction={saveGlobalSmtpSettingsAction}
                testAction={testGlobalSmtpSettingsAction}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
