
"use client";

import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Waypoints, Bell, Palette, ShieldCheck, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { SmtpSettingsForm } from "@/components/dashboard/settings/SmtpSettingsForm";
import { getSmtpSettingsAction } from "./smtp/actions";
import type { SmtpSettings } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";


export default function GeneralSettingsPage() {
  const [showSmtpDialog, setShowSmtpDialog] = useState(false);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [isLoadingSmtp, setIsLoadingSmtp] = useState(true);
  const { toast } = useToast();

  const fetchSmtpSettings = async () => {
    setIsLoadingSmtp(true);
    try {
      const settings = await getSmtpSettingsAction();
      setSmtpSettings(settings);
    } catch (error) {
      console.error("Failed to load SMTP settings:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load SMTP settings." });
    } finally {
      setIsLoadingSmtp(false);
    }
  };

  useEffect(() => {
    fetchSmtpSettings();
  }, []);

  const handleSmtpFormSubmit = () => {
    setShowSmtpDialog(false);
    fetchSmtpSettings(); // Re-fetch to update summary
  };

  return (
    <PageShell
      title="Settings"
      description="Manage your application settings and preferences."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Waypoints className="mr-2 h-5 w-5 text-primary" /> API Endpoints</CardTitle>
            <CardDescription>Configure custom API endpoints for incoming notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/settings/api">Manage API Endpoints</Link>
            </Button>
          </CardContent>
        </Card>

        <Dialog open={showSmtpDialog} onOpenChange={setShowSmtpDialog}>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><Mail className="mr-2 h-5 w-5 text-primary" /> SMTP Configuration</CardTitle>
              <CardDescription>
                {isLoadingSmtp ? <Skeleton className="h-4 w-3/4" /> : 
                  smtpSettings?.host ? `Host: ${smtpSettings.host}, User: ${smtpSettings.user}` : "Email sending is not configured."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DialogTrigger asChild>
                <Button>
                  {smtpSettings?.host ? "Edit SMTP Settings" : "Configure SMTP Settings"}
                </Button>
              </DialogTrigger>
            </CardContent>
          </Card>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>SMTP Server Configuration</DialogTitle>
              <DialogDescription>
                Configure your SMTP server to enable email features like password resets.
                Changes are saved encrypted.
              </DialogDescription>
            </DialogHeader>
            <SmtpSettingsForm initialData={smtpSettings} onFormSubmit={handleSmtpFormSubmit} />
          </DialogContent>
        </Dialog>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" /> Notification Preferences</CardTitle>
            <CardDescription>Set your preferences for app notifications. (Placeholder)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Configure (Coming Soon)</Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Appearance</CardTitle>
            <CardDescription>Customize the look and feel of the application. (Placeholder)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Customize (Coming Soon)</Button>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" /> Security</CardTitle>
            <CardDescription>Manage security settings for your account. (Placeholder)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Manage Security (Coming Soon)</Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
