"use client";

import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { z } from "zod";
import { UseFormReturn } from "react-hook-form";

// Keep this type definition for reference even if not used directly
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const securitySettingsSchema = z.object({
  id: z.string(),
  rateLimitMaxRequests: z.coerce.number().int().min(1).max(10000),
  rateLimitWindowMs: z.coerce.number().int().min(1000).max(3600000),
  maxPayloadSize: z.coerce.number().int().min(1024).max(100 * 1024 * 1024),
  logRetentionDays: z.coerce.number().int().min(1).max(365),
  apiRateLimitEnabled: z.boolean(),
  webhookRateLimitEnabled: z.boolean(),
  ipWhitelist: z.array(z.string()),
  enableDetailedErrorLogs: z.boolean(),
});

type RateLimitSettingsProps = {
  // Use a specific type based on the schema
  form: UseFormReturn<z.infer<typeof securitySettingsSchema>>; // The React Hook Form instance
  newIpAddress: string;
  setNewIpAddress: (value: string) => void;
  addIpToWhitelist: () => void;
  removeIpFromWhitelist: (ip: string) => void;
};

export function RateLimitSettings({ 
  form, 
  newIpAddress, 
  setNewIpAddress, 
  addIpToWhitelist, 
  removeIpFromWhitelist 
}: RateLimitSettingsProps) {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="apiRateLimitEnabled"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Enable API Rate Limiting</FormLabel>
              <FormDescription>
                Limit the number of API requests per client to prevent abuse
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="rateLimitMaxRequests"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maximum Requests</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  disabled={!form.watch("apiRateLimitEnabled")}
                />
              </FormControl>
              <FormDescription>
                Maximum number of requests allowed per time window
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rateLimitWindowMs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time Window (ms)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  disabled={!form.watch("apiRateLimitEnabled")}
                />
              </FormControl>
              <FormDescription>
                Time window in milliseconds (e.g., 60000 = 1 minute)
              </FormDescription>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="webhookRateLimitEnabled"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Enable Webhook Rate Limiting</FormLabel>
              <FormDescription>
                Also limit outgoing webhook calls to integrations
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!form.watch("apiRateLimitEnabled")}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="ipWhitelist"
          render={() => (
            <FormItem>
              <FormLabel>IP Whitelist</FormLabel>
              <FormDescription>
                IP addresses that are exempt from rate limiting
              </FormDescription>
              
              <div className="flex flex-wrap gap-2 mt-2">
                {form.watch("ipWhitelist")?.map((ip: string) => (
                  <Badge key={ip} variant="secondary" className="flex items-center gap-1">
                    {ip}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0"
                      onClick={() => removeIpFromWhitelist(ip)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <Input
                  placeholder="Enter IP address"
                  value={newIpAddress}
                  onChange={(e) => setNewIpAddress(e.target.value)}
                  disabled={!form.watch("apiRateLimitEnabled")}
                />
                <Button 
                  type="button" 
                  onClick={addIpToWhitelist}
                  disabled={!form.watch("apiRateLimitEnabled") || !newIpAddress}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
