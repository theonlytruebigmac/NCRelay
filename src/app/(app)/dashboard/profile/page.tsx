"use client";

import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Copy, Check, Download, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { changePasswordAction } from "@/app/(auth)/actions";
import { getInitials } from "@/lib/utils";

const profileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty.").max(100, "Name is too long."),
  email: z.string().email("Invalid email address.").max(255, "Email is too long."),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters long."),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords do not match.",
  path: ["confirmNewPassword"],
}).refine(data => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
});
type PasswordFormValues = z.infer<typeof passwordSchema>;


export default function ProfilePage() {
  const { user, updateUserName, updateUserEmail, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  
  // 2FA state
  const [twoFAStep, setTwoFAStep] = useState<'status' | 'setup' | 'verify' | 'backup'>('status');
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [loading2FA, setLoading2FA] = useState(true);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name || "",
        email: user.email || "",
      });
    }
    fetch2FAStatus();
  }, [user, profileForm]);
  
  const fetch2FAStatus = async () => {
    try {
      const response = await fetch('/api/auth/2fa/status');
      if (response.ok) {
        const data = await response.json();
        setIs2FAEnabled(data.isEnabled);
        setBackupCodesRemaining(data.backupCodesRemaining || 0);
      }
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
    } finally {
      setLoading2FA(false);
    }
  };

  const watchedName = profileForm.watch("name");
  const watchedEmail = profileForm.watch("email");

  const handleProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    const nameChanged = data.name.trim() !== (user.name || "").trim();
    const emailChanged = data.email.trim() !== (user.email || "").trim();

    if (!nameChanged && !emailChanged) {
      toast({ title: "No Changes", description: "Your profile information is already up to date." });
      return;
    }

    setIsSubmittingProfile(true);
    profileForm.clearErrors();
    let overallSuccess = true;
    const messages: { title: string; description: string; variant?: "destructive" }[] = [];

    if (nameChanged) {
      const nameFormData = new FormData();
      nameFormData.append('name', data.name.trim());
      const nameResult = await updateUserName(nameFormData);
      if (!nameResult.success) {
        overallSuccess = false;
        profileForm.setError("name", { type: "server", message: nameResult.error });
        messages.push({ variant: "destructive", title: "Name Update Failed", description: nameResult.error || "Could not update your name." });
      } else {
        messages.push({ title: "Name Updated", description: "Your name has been successfully updated." });
      }
    }

    if (emailChanged) {
      const emailFormData = new FormData();
      emailFormData.append('email', data.email.trim());
      const emailResult = await updateUserEmail(emailFormData);
      if (!emailResult.success) {
        overallSuccess = false;
        profileForm.setError("email", { type: "server", message: emailResult.error });
        messages.push({ variant: "destructive", title: "Email Update Failed", description: emailResult.error || "Could not update your email." });
      } else {
        messages.push({ title: "Email Updated", description: "Your email has been successfully updated." });
      }
    }
    setIsSubmittingProfile(false);

    if (messages.length === 1) {
      toast(messages[0]);
    } else if (messages.length > 1) {
      if (overallSuccess) {
        toast({ title: "Profile Updated", description: "Your profile information has been successfully updated." });
      } else {
         toast({ variant: "destructive", title: "Profile Update Issues", description: "Some profile updates failed. Please check the form." });
      }
    }
  };
  
  const handlePasswordSubmit = async (data: PasswordFormValues) => {
    if (!user) return;
    setIsSubmittingPassword(true);
    passwordForm.clearErrors(); // Clear previous server errors

    const formData = new FormData();
    formData.append('currentPassword', data.currentPassword);
    formData.append('newPassword', data.newPassword);

    const result = await changePasswordAction(user.id, formData);
    setIsSubmittingPassword(false);

    if (result.success) {
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
      passwordForm.reset();
    } else {
      if (result.error?.toLowerCase().includes("current password")) {
        passwordForm.setError("currentPassword", { type: "server", message: result.error });
        passwordForm.setFocus("currentPassword");
      } else if (result.error?.toLowerCase().includes("new password must be different")) {
        passwordForm.setError("newPassword", { type: "server", message: result.error});
        passwordForm.setFocus("newPassword");
      } else if (result.error) { // Fallback for other errors, e.g. validation from schema refine
         passwordForm.setError("newPassword", { type: "server", message: result.error });
         passwordForm.setFocus("newPassword");
      }
      toast({ variant: "destructive", title: "Change Password Failed", description: result.error || "Could not change your password." });
    }
  };

  const profileInfoChanged = profileForm.formState.isDirty && (
    profileForm.getValues("name").trim() !== (user?.name || "").trim() ||
    profileForm.getValues("email").trim() !== (user?.email || "").trim()
  );
  
  // 2FA functions
  const handleSetup2FA = async () => {
    setLoading2FA(true);
    try {
      const response = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to initialize 2FA setup');
      
      const data = await response.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setManualKey(data.manualEntryKey);
      setTwoFAStep('setup');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to initialize 2FA setup', variant: 'destructive' });
    } finally {
      setLoading2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (verificationCode.length !== 6) {
      toast({ title: 'Invalid Code', description: 'Please enter a 6-digit code', variant: 'destructive' });
      return;
    }

    setLoading2FA(true);
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token: verificationCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid verification code');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setTwoFAStep('backup');
      toast({ title: 'Success', description: '2FA has been enabled for your account' });
    } catch (error: any) {
      toast({ title: 'Verification Failed', description: error.message || 'Invalid verification code', variant: 'destructive' });
    } finally {
      setLoading2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) return;

    setLoading2FA(true);
    try {
      const response = await fetch('/api/auth/2fa/status', { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disable 2FA');
      }

      setIs2FAEnabled(false);
      setTwoFAStep('status');
      toast({ title: 'Success', description: '2FA has been disabled' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to disable 2FA', variant: 'destructive' });
    } finally {
      setLoading2FA(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!confirm('This will invalidate your current backup codes. Continue?')) return;

    setLoading2FA(true);
    try {
      const response = await fetch('/api/auth/2fa/status', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to regenerate backup codes');

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setTwoFAStep('backup');
      toast({ title: 'Success', description: 'New backup codes have been generated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to regenerate backup codes', variant: 'destructive' });
    } finally {
      setLoading2FA(false);
    }
  };

  const copyManualKey = () => {
    navigator.clipboard.writeText(manualKey);
    toast({ title: 'Copied', description: 'Manual entry key copied to clipboard' });
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
    toast({ title: 'Copied', description: 'Backup codes copied to clipboard' });
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

  const finishSetup2FA = () => {
    setIs2FAEnabled(true);
    setTwoFAStep('status');
    fetch2FAStatus();
  };

  return (
    <PageShell
      title="User Profile"
      description="View and manage your profile information."
    >
      <div className="grid gap-8 md:grid-cols-1 max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(watchedName)}`} alt={watchedName || "User"} data-ai-hint="user avatar"/>
                  <AvatarFallback>{getInitials(watchedName)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{watchedName || "User Name"}</h2>
                  <p className="text-sm text-muted-foreground">{watchedEmail}</p>
                </div>
              </div>
            
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="name">Full Name</FormLabel>
                      <FormControl>
                        <Input 
                          id="name" 
                          placeholder="Your full name" 
                          {...field}
                          disabled={authLoading || isSubmittingProfile}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="email">Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          id="email" 
                          type="email"
                          placeholder="your@email.com" 
                          {...field}
                          disabled={authLoading || isSubmittingProfile}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={authLoading || isSubmittingProfile || !profileInfoChanged}>
                    {isSubmittingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-6">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSubmittingPassword || authLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSubmittingPassword || authLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSubmittingPassword || authLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmittingPassword || authLoading}>
                    {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
            <CardDescription>
              Add an extra layer of security to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {twoFAStep === 'status' && (
              <>
                {is2FAEnabled ? (
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
                        <Button onClick={handleRegenerateBackupCodes} variant="outline" disabled={loading2FA}>
                          Regenerate Backup Codes
                        </Button>
                        <Button onClick={handleDisable2FA} variant="destructive" disabled={loading2FA}>
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

                    <Button onClick={handleSetup2FA} disabled={loading2FA}>
                      {loading2FA && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enable Two-Factor Authentication
                    </Button>
                  </>
                )}
              </>
            )}

            {twoFAStep === 'setup' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Step 1: Scan QR Code</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use your authenticator app to scan this QR code
                  </p>
                </div>

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

                <Button onClick={() => setTwoFAStep('verify')} className="w-full">
                  Continue to Verification
                </Button>
              </div>
            )}

            {twoFAStep === 'verify' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Step 2: Verify Code</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

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
                  <Button onClick={() => setTwoFAStep('setup')} variant="outline">
                    Back
                  </Button>
                  <Button onClick={handleVerify2FA} disabled={loading2FA || verificationCode.length !== 6} className="flex-1">
                    {loading2FA && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify and Enable
                  </Button>
                </div>
              </div>
            )}

            {twoFAStep === 'backup' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Step 3: Save Backup Codes</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Store these codes in a safe place. Each can only be used once.
                  </p>
                </div>

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

                <Button onClick={finishSetup2FA} className="w-full">
                  Finish Setup
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

