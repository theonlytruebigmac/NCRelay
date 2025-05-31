"use client";

import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import type { SecuritySettings } from "@/lib/types";

type LoggingSettingsProps = {
  form: UseFormReturn<SecuritySettings>;
};

export function LoggingSettings({ form }: LoggingSettingsProps) {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="logRetentionDays"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Log Retention (days)</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormDescription>
              Number of days to retain logs before automatic cleanup
            </FormDescription>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="maxPayloadSize"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Maximum Payload Size (bytes)</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormDescription>
              Maximum size of request payloads in bytes (e.g., 10485760 = 10MB)
            </FormDescription>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="enableDetailedErrorLogs"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Detailed Error Logging</FormLabel>
              <FormDescription>
                Include detailed error information in logs (may include sensitive data)
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

      <Alert className="bg-amber-50 text-amber-900 border-amber-200">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Security Notice</AlertTitle>
        <AlertDescription>
          Detailed error logs may contain sensitive information. Only enable this option for debugging purposes and disable it in production.
        </AlertDescription>
      </Alert>
    </div>
  );
}
