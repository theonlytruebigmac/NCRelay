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
import { Loader2, Shield, Copy, Check, Download, AlertCircle, Palette, Sun, Moon, Monitor } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { changePasswordAction } from "@/app/(auth)/actions";
import { getInitials } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  const { theme, setTheme } = useTheme();
  
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
      title="Profile"
      description="Manage your profile, security, and preferences."
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Header */}
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(watchedName)}`} alt={watchedName || "User"} data-ai-hint="user avatar"/>
                <AvatarFallback className="text-2xl">{getInitials(watchedName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left space-y-1">
                <h2 className="text-2xl font-bold">{watchedName || "User Name"}</h2>
                <p className="text-muted-foreground">{watchedEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Account Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your full name" 
                            {...field}
                            disabled={authLoading || isSubmittingProfile}
                            className="h-10"
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
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="your@email.com" 
                            {...field}
                            disabled={authLoading || isSubmittingProfile}
                            className="h-10"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {profileInfoChanged && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-muted-foreground">You have unsaved changes</p>
                    <Button type="submit" disabled={authLoading || isSubmittingProfile}>
                      {isSubmittingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Security Section */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Security</h3>
            <p className="text-sm text-muted-foreground">Manage your password and authentication settings</p>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Change Password</CardTitle>
              <CardDescription>Ensure your account is using a strong password</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-5">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter current password" 
                          {...field} 
                          disabled={isSubmittingPassword || authLoading}
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter new password" 
                            {...field} 
                            disabled={isSubmittingPassword || authLoading}
                            className="h-10"
                          />
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
                          <Input 
                            type="password" 
                            placeholder="Confirm new password" 
                            {...field} 
                            disabled={isSubmittingPassword || authLoading}
                            className="h-10"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" disabled={isSubmittingPassword || authLoading}>
                    {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${is2FAEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                    <Shield className={`h-5 w-5 ${is2FAEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
                    <CardDescription>
                      {is2FAEnabled ? 'Your account is protected' : 'Add an extra layer of security'}
                    </CardDescription>
                  </div>
                </div>
                {is2FAEnabled && (
                  <div className="flex items-center gap-2 text-xs font-medium text-green-600 bg-green-500/10 px-3 py-1.5 rounded-full">
                    <Check className="h-3 w-3" />
                    Active
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
            {twoFAStep === 'status' && (
              <>
                {is2FAEnabled ? (
                  <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="p-2 rounded-full bg-green-500/10">
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Protection Active</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your account is secured with two-factor authentication
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div>
                          <p className="text-sm font-medium">Backup Codes</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {backupCodesRemaining} codes remaining
                          </p>
                        </div>
                        {backupCodesRemaining < 3 && (
                          <div className="flex items-center gap-2 text-xs font-medium text-orange-600 bg-orange-500/10 px-3 py-1.5 rounded-full">
                            <AlertCircle className="h-3 w-3" />
                            Low
                          </div>
                        )}
                      </div>

                      {backupCodesRemaining < 3 && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            You're running low on backup codes. Generate new ones to ensure you can always access your account.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button onClick={handleRegenerateBackupCodes} variant="outline" disabled={loading2FA} className="flex-1">
                          Regenerate Backup Codes
                        </Button>
                        <Button onClick={handleDisable2FA} variant="destructive" disabled={loading2FA} className="flex-1">
                          Disable 2FA
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <div className="p-2 rounded-full bg-orange-500/10">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Not Protected</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Enable 2FA to add an extra layer of security to your account
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                      <h4 className="font-medium text-sm">How it works</h4>
                      <ol className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-3">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">1</span>
                          <span>Scan a QR code with your authenticator app</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">2</span>
                          <span>Enter the 6-digit code to verify</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">3</span>
                          <span>Save your backup codes in a secure location</span>
                        </li>
                      </ol>
                    </div>

                    <Button onClick={handleSetup2FA} disabled={loading2FA} className="w-full sm:w-auto">
                      {loading2FA && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enable Two-Factor Authentication
                    </Button>
                  </div>
                )}
              </>
            )}

            {twoFAStep === 'setup' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 mb-3">
                    <span className="text-lg font-semibold text-primary">1</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Scan QR Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Open your authenticator app and scan this code
                  </p>
                </div>

                <div className="flex justify-center p-6 bg-muted/30 rounded-lg border">
                  {qrCode && (
                    <img src={qrCode} alt="2FA QR Code" className="w-56 h-56 rounded-lg" />
                  )}
                </div>

                <div className="space-y-3 p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground"></div>
                    <Label className="text-sm font-medium">Manual Entry</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Can't scan? Enter this key manually in your authenticator app
                  </p>
                  <div className="flex gap-2">
                    <Input value={manualKey} readOnly className="font-mono text-sm h-9" />
                    <Button onClick={copyManualKey} variant="outline" size="icon" className="h-9 w-9 shrink-0">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={() => setTwoFAStep('status')} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={() => setTwoFAStep('verify')} className="flex-1">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {twoFAStep === 'verify' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 mb-3">
                    <span className="text-lg font-semibold text-primary">2</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Verify Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="code" className="sr-only">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-3xl tracking-[0.5em] font-mono h-16 border-2"
                    autoFocus
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    The code refreshes every 30 seconds
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={() => setTwoFAStep('setup')} variant="outline" className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleVerify2FA} disabled={loading2FA || verificationCode.length !== 6} className="flex-1">
                    {loading2FA && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify & Enable
                  </Button>
                </div>
              </div>
            )}

            {twoFAStep === 'backup' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-green-500/10 mb-3">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Save Backup Codes</h3>
                  <p className="text-sm text-muted-foreground">
                    Store these codes securely. Each code can only be used once.
                  </p>
                </div>

                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    Important: These codes won't be shown again. Save them now!
                  </AlertDescription>
                </Alert>

                <div className="p-6 rounded-lg border-2 border-dashed bg-muted/30">
                  <div className="font-mono text-sm grid grid-cols-2 gap-3">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="text-center p-2 rounded bg-background border font-semibold tracking-wider">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={copyBackupCodes} variant="outline">
                    {copiedBackup ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copiedBackup ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button onClick={downloadBackupCodes} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>

                <Button onClick={finishSetup2FA} className="w-full" size="lg">
                  Complete Setup
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Preferences Section */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Preferences</h3>
            <p className="text-sm text-muted-foreground">Customize your experience</p>
          </div>

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Palette className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Appearance</CardTitle>
                  <CardDescription>Choose your preferred theme</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <RadioGroup value={theme} onValueChange={setTheme} className="grid gap-3">
                <Label
                  htmlFor="light"
                  className={`flex items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent ${
                    theme === 'light' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Sun className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Light</div>
                      <div className="text-xs text-muted-foreground">Clean and bright</div>
                    </div>
                  </div>
                  <RadioGroupItem value="light" id="light" />
                </Label>
                
                <Label
                  htmlFor="dark"
                  className={`flex items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent ${
                    theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Moon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Dark</div>
                      <div className="text-xs text-muted-foreground">Easy on the eyes</div>
                    </div>
                  </div>
                  <RadioGroupItem value="dark" id="dark" />
                </Label>
                
                <Label
                  htmlFor="system"
                  className={`flex items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent ${
                    theme === 'system' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">System</div>
                      <div className="text-xs text-muted-foreground">Match your device</div>
                    </div>
                  </div>
                  <RadioGroupItem value="system" id="system" />
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

