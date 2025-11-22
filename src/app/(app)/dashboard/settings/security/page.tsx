"use client";

import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { SecuritySettings } from "@/lib/types";
import { Form } from "@/components/ui/form";
import { getSecuritySettingsAction, updateSecuritySettingsAction } from "./actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RateLimitSettings } from "@/components/dashboard/settings/RateLimitSettings";
import { LoggingSettings } from "@/components/dashboard/settings/LoggingSettings";

// Schema for validating security settings
const securitySettingsSchema = z.object({
  id: z.string(),
  rateLimitMaxRequests: z.number().int().min(1).max(10000),
  rateLimitWindowMs: z.number().int().min(1000).max(3600000),
  maxPayloadSize: z.number().int().min(1024).max(100 * 1024 * 1024), // 1KB to 100MB
  logRetentionDays: z.number().int().min(1).max(365), // 1 day to 1 year
  apiRateLimitEnabled: z.boolean(),
  webhookRateLimitEnabled: z.boolean(),
  ipWhitelist: z.array(z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address')),
  enableDetailedErrorLogs: z.boolean(),
});

export default function SecuritySettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // We're using this state for tracking when settings were loaded 
  // and when form needs to be reset
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState("");
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof securitySettingsSchema>>({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues: {
      id: 'default_security_settings',
      rateLimitMaxRequests: 100,
      rateLimitWindowMs: 60000,
      maxPayloadSize: 10485760,
      logRetentionDays: 30,
      apiRateLimitEnabled: true,
      webhookRateLimitEnabled: false,
      ipWhitelist: [],
      enableDetailedErrorLogs: false,
    },
  });

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getSecuritySettingsAction();
      setSettingsLoaded(true);
      form.reset({
        rateLimitMaxRequests: settings.rateLimitMaxRequests,
        rateLimitWindowMs: settings.rateLimitWindowMs,
        maxPayloadSize: settings.maxPayloadSize,
        logRetentionDays: settings.logRetentionDays,
        apiRateLimitEnabled: settings.apiRateLimitEnabled,
        webhookRateLimitEnabled: settings.webhookRateLimitEnabled,
        ipWhitelist: settings.ipWhitelist,
        enableDetailedErrorLogs: settings.enableDetailedErrorLogs,
      });
    } catch (error) {
      console.error("Failed to load security settings:", error);
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "Could not load security settings." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data: z.infer<typeof securitySettingsSchema>) => {
    setIsSaving(true);
    try {
      await updateSecuritySettingsAction(data);
      toast({
        title: "Settings updated",
        description: "Security settings have been updated successfully.",
      });
      fetchSettings(); // Reload the settings
    } catch (error) {
      console.error("Failed to update security settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update security settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addIpToWhitelist = () => {
    if (!newIpAddress) return;
    
    // Simple IP validation regex (both IPv4 and IPv6)
    const ipRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
    
    if (!ipRegex.test(newIpAddress)) {
      toast({
        variant: "destructive",
        title: "Invalid IP Address",
        description: "Please enter a valid IPv4 or IPv6 address.",
      });
      return;
    }
    
    const currentIps = form.getValues("ipWhitelist") || [];
    if (currentIps.includes(newIpAddress)) {
      toast({
        variant: "destructive",
        title: "Duplicate IP",
        description: "This IP address is already in the whitelist.",
      });
      return;
    }
    
    form.setValue("ipWhitelist", [...currentIps, newIpAddress]);
    setNewIpAddress("");
  };

  const removeIpFromWhitelist = (ip: string) => {
    const currentIps = form.getValues("ipWhitelist") || [];
    form.setValue("ipWhitelist", currentIps.filter(i => i !== ip));
  };

  if (isLoading) {
    return (
      <PageShell 
        title="Security & Rate Limiting" 
        description="Configure security and rate limiting settings"
      >
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-6 w-6" />
          <CardTitle>Security Settings</CardTitle>
        </div>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Loading security and rate limiting settings...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell 
      title="Security & Rate Limiting" 
      description="Configure security and rate limiting settings"
    >
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-6 w-6" />
        <h2 className="text-xl font-semibold">Security Settings</h2>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="rate-limiting" className="mb-6">
            <TabsList className="mb-4">
              <TabsTrigger value="rate-limiting">Rate Limiting</TabsTrigger>
              <TabsTrigger value="logging">Logging & Security</TabsTrigger>
            </TabsList>
            
            <TabsContent value="rate-limiting">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>API Rate Limiting</CardTitle>
                  <CardDescription>Configure rate limiting for API endpoints to prevent abuse</CardDescription>
                </CardHeader>
                <CardContent>
                  <RateLimitSettings 
                    form={form} 
                    newIpAddress={newIpAddress}
                    setNewIpAddress={setNewIpAddress}
                    addIpToWhitelist={addIpToWhitelist}
                    removeIpFromWhitelist={removeIpFromWhitelist}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="logging">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Logging & Security</CardTitle>
                  <CardDescription>Configure logging and security-related settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <LoggingSettings form={form} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </PageShell>
  );
}
