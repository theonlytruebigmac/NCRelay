'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, Timer, AlertTriangle, Loader2, Gauge, Plus, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SecuritySettings {
  tenantId: string;
  enforce2FA: boolean;
  require2FAForAdmins: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  sessionTimeoutMinutes: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  rateLimitEnabled?: boolean;
  rateLimitMaxRequests?: number;
  rateLimitWindowMs?: number;
  rateLimitIpWhitelist?: string[];
}

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [newIpAddress, setNewIpAddress] = useState('');

  useEffect(() => {
    // Get tenant ID from user context
    const fetchUserAndTenant = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          // Use user's tenantId if they belong to a tenant
          if (userData.tenantId) {
            setTenantId(userData.tenantId);
          } else {
            // System admin - check cookie for selected tenant
            const cookies = document.cookie.split(';');
            const tenantCookie = cookies.find(c => c.trim().startsWith('currentTenantId='));
            if (tenantCookie) {
              const id = tenantCookie.split('=')[1];
              setTenantId(id);
            } else {
              // No tenant context available
              setLoading(false);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user context:', error);
        setLoading(false);
      }
    };
    fetchUserAndTenant();
  }, []);

  useEffect(() => {
    if (tenantId) {
      fetchSettings();
    }
  }, [tenantId]);

  const fetchSettings = async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/security`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        const errorData = await response.json();
        console.error('Failed to load settings:', errorData);
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to load security settings',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching security settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !settings) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/security`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Security settings updated successfully',
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update security settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof SecuritySettings>(
    key: K,
    value: SecuritySettings[K]
  ) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const addIpToWhitelist = () => {
    if (!newIpAddress || !settings) return;
    
    const ipRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
    
    if (!ipRegex.test(newIpAddress)) {
      toast({
        variant: "destructive",
        title: "Invalid IP Address",
        description: "Please enter a valid IPv4 address.",
      });
      return;
    }
    
    const currentIps = settings.rateLimitIpWhitelist || [];
    if (currentIps.includes(newIpAddress)) {
      toast({
        variant: "destructive",
        title: "Duplicate IP",
        description: "This IP address is already in the whitelist.",
      });
      return;
    }
    
    setSettings({ ...settings, rateLimitIpWhitelist: [...currentIps, newIpAddress] });
    setNewIpAddress("");
  };

  const removeIpFromWhitelist = (ip: string) => {
    if (!settings) return;
    const currentIps = settings.rateLimitIpWhitelist || [];
    setSettings({ ...settings, rateLimitIpWhitelist: currentIps.filter(i => i !== ip) });
  };

  if (loading) {
    return (
      <PageShell
        title="Security Policies"
        description="Configure security and rate limiting policies for your tenant"
      >
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (!tenantId && !loading) {
    return (
      <PageShell
        title="Security Policies"
        description="Configure security and rate limiting policies for your tenant"
      >
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select a tenant to manage security policies. System administrators must select a tenant from the tenant selector.
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  if (!settings) {
    return (
      <PageShell
        title="Security Policies"
        description="Configure security and rate limiting policies for your tenant"
      >
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load security settings</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Security Policies"
      description="Configure security and rate limiting policies for your tenant"
    >
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Require users to use 2FA for enhanced account security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enforce 2FA for all users</Label>
              <p className="text-sm text-muted-foreground">
                All users must enable 2FA to access their accounts
              </p>
            </div>
            <Switch
              checked={settings.enforce2FA}
              onCheckedChange={(checked) => updateSetting('enforce2FA', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require 2FA for administrators</Label>
              <p className="text-sm text-muted-foreground">
                Only owners and administrators must enable 2FA
              </p>
            </div>
            <Switch
              checked={settings.require2FAForAdmins}
              onCheckedChange={(checked) => updateSetting('require2FAForAdmins', checked)}
              disabled={settings.enforce2FA}
            />
          </div>

          {settings.enforce2FA && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                All users will be required to set up 2FA on their next login
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-indigo-600" />
            <CardTitle>Password Requirements</CardTitle>
          </div>
          <CardDescription>
            Set password complexity rules for user accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="passwordMinLength">Minimum password length</Label>
            <Input
              id="passwordMinLength"
              type="number"
              min={6}
              max={32}
              value={settings.passwordMinLength}
              onChange={(e) => updateSetting('passwordMinLength', parseInt(e.target.value) || 8)}
            />
            <p className="text-sm text-muted-foreground">
              Must be between 6 and 32 characters
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Require uppercase letters</Label>
              <Switch
                checked={settings.passwordRequireUppercase}
                onCheckedChange={(checked) => updateSetting('passwordRequireUppercase', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Require lowercase letters</Label>
              <Switch
                checked={settings.passwordRequireLowercase}
                onCheckedChange={(checked) => updateSetting('passwordRequireLowercase', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Require numbers</Label>
              <Switch
                checked={settings.passwordRequireNumbers}
                onCheckedChange={(checked) => updateSetting('passwordRequireNumbers', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Require symbols (!@#$%^&*)</Label>
              <Switch
                checked={settings.passwordRequireSymbols}
                onCheckedChange={(checked) => updateSetting('passwordRequireSymbols', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-indigo-600" />
            <CardTitle>Session & Lockout Settings</CardTitle>
          </div>
          <CardDescription>
            Configure session timeouts and account lockout policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="sessionTimeout">Session timeout (minutes)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              min={5}
              max={10080}
              value={settings.sessionTimeoutMinutes}
              onChange={(e) => updateSetting('sessionTimeoutMinutes', parseInt(e.target.value) || 480)}
            />
            <p className="text-sm text-muted-foreground">
              Inactive sessions will be logged out after this time (5 min to 7 days)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxFailedAttempts">Maximum failed login attempts</Label>
            <Input
              id="maxFailedAttempts"
              type="number"
              min={3}
              max={20}
              value={settings.maxFailedLoginAttempts}
              onChange={(e) => updateSetting('maxFailedLoginAttempts', parseInt(e.target.value) || 5)}
            />
            <p className="text-sm text-muted-foreground">
              Account will be locked after this many failed attempts (3-20)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lockoutDuration">Lockout duration (minutes)</Label>
            <Input
              id="lockoutDuration"
              type="number"
              min={5}
              max={1440}
              value={settings.lockoutDurationMinutes}
              onChange={(e) => updateSetting('lockoutDurationMinutes', parseInt(e.target.value) || 15)}
            />
            <p className="text-sm text-muted-foreground">
              How long accounts remain locked after failed attempts (5 min to 24 hours)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-indigo-600" />
            <CardTitle>API Rate Limiting</CardTitle>
          </div>
          <CardDescription>
            Control API request limits to prevent abuse and ensure service stability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable API rate limiting</Label>
              <p className="text-sm text-muted-foreground">
                Limit the number of API requests per client to prevent abuse
              </p>
            </div>
            <Switch
              checked={settings.rateLimitEnabled || false}
              onCheckedChange={(checked) => updateSetting('rateLimitEnabled', checked)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rateLimitMaxRequests">Maximum requests</Label>
              <Input
                id="rateLimitMaxRequests"
                type="number"
                min={1}
                max={10000}
                value={settings.rateLimitMaxRequests || 100}
                onChange={(e) => updateSetting('rateLimitMaxRequests', parseInt(e.target.value) || 100)}
                disabled={!settings.rateLimitEnabled}
              />
              <p className="text-sm text-muted-foreground">
                Maximum number of requests allowed per time window
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateLimitWindowMs">Time window (seconds)</Label>
              <Input
                id="rateLimitWindowMs"
                type="number"
                min={1}
                max={3600}
                value={((settings.rateLimitWindowMs || 60000) / 1000)}
                onChange={(e) => updateSetting('rateLimitWindowMs', (parseInt(e.target.value) || 60) * 1000)}
                disabled={!settings.rateLimitEnabled}
              />
              <p className="text-sm text-muted-foreground">
                Time window in seconds (e.g., 60 = 1 minute)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>IP Whitelist</Label>
            <p className="text-sm text-muted-foreground mb-2">
              IP addresses that are exempt from rate limiting
            </p>
            
            {(settings.rateLimitIpWhitelist && settings.rateLimitIpWhitelist.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-2">
                {settings.rateLimitIpWhitelist.map((ip: string) => (
                  <Badge key={ip} variant="secondary" className="flex items-center gap-1">
                    {ip}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeIpFromWhitelist(ip)}
                      disabled={!settings.rateLimitEnabled}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter IP address (e.g., 192.168.1.1)"
                value={newIpAddress}
                onChange={(e) => setNewIpAddress(e.target.value)}
                disabled={!settings.rateLimitEnabled}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addIpToWhitelist();
                  }
                }}
              />
              <Button 
                type="button" 
                onClick={addIpToWhitelist}
                disabled={!settings.rateLimitEnabled || !newIpAddress}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
      </div>
    </PageShell>
  );
}
