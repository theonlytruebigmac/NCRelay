"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Save, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationPreferences } from "@/lib/types";
import { getNotificationPreferencesAction, updateNotificationPreferencesAction } from ".";

const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
  systemNotifications: z.boolean(),
  importantOnly: z.boolean(),
  failureNotificationsOnly: z.boolean(),
  emailDigestFrequency: z.enum(["never", "daily", "weekly", "monthly"]),
});

export type NotificationPreferencesFormValues = z.infer<typeof notificationPreferencesSchema>;

export default function NotificationPreferencesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<NotificationPreferencesFormValues>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      emailNotifications: true,
      systemNotifications: true,
      importantOnly: false,
      failureNotificationsOnly: true,
      emailDigestFrequency: "never",
    },
  });

  const fetchPreferences = async () => {
    setIsLoading(true);
    try {
      const preferences = await getNotificationPreferencesAction();
      if (preferences) {
        form.reset({
          emailNotifications: preferences.emailNotifications,
          systemNotifications: preferences.systemNotifications,
          importantOnly: preferences.importantOnly,
          failureNotificationsOnly: preferences.failureNotificationsOnly,
          emailDigestFrequency: preferences.emailDigestFrequency,
        });
      }
    } catch (error) {
      console.error("Failed to load notification preferences:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load notification preferences." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data: NotificationPreferencesFormValues) => {
    setIsSaving(true);
    try {
      await updateNotificationPreferencesAction(data);
      toast({
        title: "Preferences updated",
        description: "Your notification preferences have been updated successfully.",
      });
      fetchPreferences(); // Reload the preferences
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update notification preferences.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell 
        title="Notification Preferences" 
        description="Manage how you receive notifications."
      >
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>Loading notification preferences...</CardDescription>
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
      title="Notification Preferences" 
      description="Manage how you receive notifications."
    >
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-6 w-6" />
        <h2 className="text-xl font-semibold">Notification Preferences</h2>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Configure how and when you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="emailNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Email Notifications</FormLabel>
                      <FormDescription>
                        Receive notifications via email
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">System Notifications</FormLabel>
                      <FormDescription>
                        Receive notifications in the browser
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="importantOnly"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Important Notifications Only</FormLabel>
                      <FormDescription>
                        Only receive notifications marked as important
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="failureNotificationsOnly"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Failure Notifications Only</FormLabel>
                      <FormDescription>
                        Only receive notifications about failed relay attempts
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailDigestFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Digest Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often you want to receive email digests of notifications
                    </FormDescription>
                  </FormItem>
                )}
              />

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
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
