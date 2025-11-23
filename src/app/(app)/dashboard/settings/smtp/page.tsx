'use client';

import { useState, useEffect } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { Loader2, Mail, Send, Trash2, Save } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

export default function SmtpSettingsPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { can } = usePermissions();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  
  // Form state
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [useTLS, setUseTLS] = useState(true);
  const [testEmail, setTestEmail] = useState('');

  const canManageSettings = can('settings', 'manage');

  useEffect(() => {
    if (currentTenant) {
      loadSettings();
    }
  }, [currentTenant]);

  const loadSettings = async () => {
    if (!currentTenant) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tenants/${currentTenant.id}/smtp`);
      if (response.ok) {
        const data = await response.json();
        if (data.configured) {
          setConfigured(true);
          setHost(data.settings.host);
          setPort(data.settings.port);
          setUsername(data.settings.username);
          setFromAddress(data.settings.fromAddress);
          setFromName(data.settings.fromName || '');
          setUseTLS(!!data.settings.useTLS);
          // Don't set password - it's encrypted on server
        }
      }
    } catch (error) {
      console.error('Failed to load SMTP settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTenant || !canManageSettings) return;

    if (!host || !username || !fromAddress) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    if (!configured && !password) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password is required for new SMTP configuration',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tenants/${currentTenant.id}/smtp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          port,
          username,
          password: password || undefined,
          fromAddress,
          fromName: fromName || undefined,
          useTLS,
        }),
      });

      if (response.ok) {
        setConfigured(true);
        setPassword(''); // Clear password field
        toast({
          title: 'Success',
          description: 'SMTP settings saved successfully',
        });
      } else {
        const error = await response.json();
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.error || 'Failed to save SMTP settings',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save SMTP settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!currentTenant || !testEmail) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a test email address',
      });
      return;
    }

    if (!host || !username || !fromAddress || (!configured && !password)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all SMTP settings before testing',
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch(`/api/tenants/${currentTenant.id}/smtp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testEmail,
          settings: {
            host,
            port,
            username,
            password: password || 'dummy', // Use dummy if not changed
            fromAddress,
            fromName: fromName || undefined,
            useTLS,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Test Successful',
          description: `Test email sent to ${testEmail}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Test Failed',
          description: data.error || 'Failed to send test email',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to test SMTP settings',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentTenant || !canManageSettings) return;

    if (!confirm('Are you sure you want to delete the SMTP configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tenants/${currentTenant.id}/smtp`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConfigured(false);
        setHost('');
        setPort(587);
        setUsername('');
        setPassword('');
        setFromAddress('');
        setFromName('');
        setUseTLS(true);
        toast({
          title: 'Success',
          description: 'SMTP settings deleted successfully',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to delete SMTP settings',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete SMTP settings',
      });
    }
  };

  if (!currentTenant) {
    return null;
  }

  if (!canManageSettings) {
    return (
      <PageShell title="SMTP Settings" description="Email configuration">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">You don't have permission to manage SMTP settings.</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="SMTP Settings"
      description="Configure email server settings for this tenant"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Server Configuration
          </CardTitle>
          <CardDescription>
            Configure SMTP settings to send emails from this tenant. These settings are used for
            password resets, notifications, and welcome emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">SMTP Host *</Label>
                  <Input
                    id="host"
                    placeholder="smtp.example.com"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="587"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value) || 587)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    placeholder="user@example.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password {configured && '(leave blank to keep current)'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={configured ? '••••••••' : 'Password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromAddress">From Email Address *</Label>
                  <Input
                    id="fromAddress"
                    type="email"
                    placeholder="noreply@example.com"
                    value={fromAddress}
                    onChange={(e) => setFromAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name (optional)</Label>
                  <Input
                    id="fromName"
                    placeholder="NCRelay"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="useTLS"
                  checked={useTLS}
                  onCheckedChange={setUseTLS}
                />
                <Label htmlFor="useTLS" className="cursor-pointer">
                  Use TLS/SSL (Recommended)
                </Label>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-sm font-medium mb-4">Test Configuration</h3>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleTest}
                    disabled={isTesting}
                    variant="outline"
                  >
                    {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />
                    Send Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Send a test email to verify your SMTP configuration
                </p>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <div>
                  {configured && (
                    <Button
                      onClick={handleDelete}
                      variant="destructive"
                      disabled={isSaving}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Configuration
                    </Button>
                  )}
                </div>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
