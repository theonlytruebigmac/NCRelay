'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Copy, Check, Download, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'backup'>('status');
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/auth/2fa/status');
      if (response.ok) {
        const data = await response.json();
        setIsEnabled(data.isEnabled);
        setBackupCodesRemaining(data.backupCodesRemaining || 0);
      }
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to initialize 2FA setup');
      }

      const data = await response.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setManualKey(data.manualEntryKey);
      setStep('setup');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initialize 2FA setup',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          token: verificationCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid verification code');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setStep('backup');
      
      toast({
        title: 'Success',
        description: '2FA has been enabled for your account',
      });
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid verification code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/status', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disable 2FA');
      }

      setIsEnabled(false);
      setStep('status');
      
      toast({
        title: 'Success',
        description: '2FA has been disabled',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disable 2FA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!confirm('This will invalidate your current backup codes. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/status', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate backup codes');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setStep('backup');
      
      toast({
        title: 'Success',
        description: 'New backup codes have been generated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to regenerate backup codes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyManualKey = () => {
    navigator.clipboard.writeText(manualKey);
    toast({
      title: 'Copied',
      description: 'Manual entry key copied to clipboard',
    });
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
    toast({
      title: 'Copied',
      description: 'Backup codes copied to clipboard',
    });
  };

  const downloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ncrelay-2fa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const finishSetup = () => {
    setIsEnabled(true);
    setStep('status');
    router.push('/dashboard/settings');
  };

  if (loading && step === 'status') {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      {step === 'status' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-indigo-600" />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
            <CardDescription>
              Add an extra layer of security to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEnabled ? (
              <>
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    Two-factor authentication is currently enabled for your account.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Backup codes remaining: <span className="font-semibold">{backupCodesRemaining}</span>
                    </p>
                    {backupCodesRemaining < 3 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          You're running low on backup codes. Consider regenerating them.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleRegenerateBackupCodes} variant="outline">
                      Regenerate Backup Codes
                    </Button>
                    <Button onClick={handleDisable} variant="destructive">
                      Disable 2FA
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Two-factor authentication is not enabled. Enable it to protect your account.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <h3 className="font-semibold">How it works:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Scan a QR code with your authenticator app</li>
                    <li>Enter the 6-digit code to verify</li>
                    <li>Save your backup codes in a secure location</li>
                    <li>Use your authenticator app every time you log in</li>
                  </ol>
                </div>

                <Button onClick={handleSetup} disabled={loading}>
                  Enable Two-Factor Authentication
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'setup' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Scan QR Code</CardTitle>
            <CardDescription>
              Use your authenticator app to scan this QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              {qrCode && (
                <img src={qrCode} alt="2FA QR Code" className="w-64 h-64" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Can't scan the QR code?</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Enter this key manually in your authenticator app:
              </p>
              <div className="flex gap-2">
                <Input value={manualKey} readOnly className="font-mono" />
                <Button onClick={copyManualKey} variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button onClick={() => setStep('verify')} className="w-full">
              Continue to Verification
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'verify' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Verify Code</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep('setup')} variant="outline">
                Back
              </Button>
              <Button onClick={handleVerify} disabled={loading || verificationCode.length !== 6} className="flex-1">
                Verify and Enable
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'backup' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Save Backup Codes</CardTitle>
            <CardDescription>
              Store these codes in a safe place. Each can only be used once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                These codes won't be shown again. Save them now!
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg font-mono text-sm grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <div key={index} className="text-center">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button onClick={copyBackupCodes} variant="outline" className="flex-1">
                {copiedBackup ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedBackup ? 'Copied!' : 'Copy Codes'}
              </Button>
              <Button onClick={downloadBackupCodes} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <Button onClick={finishSetup} className="w-full">
              Finish Setup
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
