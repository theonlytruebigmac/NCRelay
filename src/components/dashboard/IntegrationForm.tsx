"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form"; // Import UseFormReturn
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Integration, Platform, FieldFilterConfig } from "@/lib/types";
import { platformOptions, getPlatformFormatDescription } from "@/lib/platform-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhookUrlField } from "@/components/ui/webhook-url-field";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const integrationSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }).max(50),
  platform: z.enum(['slack', 'discord', 'teams', 'generic_webhook']),
  webhookUrl: z.string().url({ message: "Invalid webhook URL." }),
  enabled: z.boolean().default(true),
  fieldFilterId: z.union([
    z.literal('none'),  // For "No filter" selection
    z.string().min(1)   // For actual filter IDs
  ]).optional(),
});

export type IntegrationFormValues = z.infer<typeof integrationSchema>;

interface IntegrationFormProps {
  initialData?: Partial<Integration>; // Keep for initial population if formInstance is not used for that
  onSubmit: (data: IntegrationFormValues) => Promise<void>; // Raw handler that receives form data
  isSubmitting?: boolean;
  submitButtonText?: string;
  fieldFilters?: FieldFilterConfig[];
  formInstance?: UseFormReturn<IntegrationFormValues>; // Prop to receive form instance
}

// Export the schema so parent pages can use it with their useForm hook
export const IntegrationFormSchema = integrationSchema;


export function IntegrationForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitButtonText = "Save Integration",
  formInstance, // Receive the form instance from parent
  fieldFilters = [] // Default to empty array if not provided
}: IntegrationFormProps) {
  // If formInstance is provided, use it; otherwise, create a local one.
  // This allows the parent to control the form if needed for setError, etc.
  const localForm = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      name: initialData?.name || "",
      platform: initialData?.platform || 'generic_webhook',
      webhookUrl: initialData?.webhookUrl || "",
      enabled: initialData?.enabled ?? true,
      fieldFilterId: initialData?.fieldFilterId || 'none',
    },
  });

  const form = formInstance || localForm;

  // If initialData is provided and formInstance is used,
  // parent should call form.reset(initialData)
  useEffect(() => {
    if (initialData && formInstance) {
       // Parent should call form.reset, but as a fallback:
       // formInstance.reset(initialData);
    }
  }, [initialData, formInstance]);

  const selectedPlatform = form.watch('platform');

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>{initialData?.id ? "Edit Integration" : "Create New Integration"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/* The onSubmit here needs to be wrapped with form.handleSubmit */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Integration Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Awesome Slack Channel" {...field} />
                  </FormControl>
                  <FormDescription>A descriptive name for this integration.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value as Platform);
                      // Logic to set a default targetFormat is now in useEffect
                    }}
                    value={field.value} // Ensure value prop is used for controlled component
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a messaging platform" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {platformOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center">
                            <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose the target messaging platform.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="webhookUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Webhook URL</FormLabel>
                  <FormControl>
                    <WebhookUrlField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="https://hooks.slack.com/services/..."
                      disabled={isSubmitting}
                      isFormField={true}
                    />
                  </FormControl>
                  <FormDescription>The webhook URL provided by the platform.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card className="bg-secondary/50 p-4">
              <CardHeader className="p-0 pb-4">
                 <CardTitle className="text-lg">Payload Configuration</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                {/* Format info display */}
                <div className="rounded-md border border-muted bg-muted/20 p-3">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Output Format</h4>
                  <p className="text-sm text-foreground">
                    {getPlatformFormatDescription(selectedPlatform)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Format is automatically determined by the selected platform
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="fieldFilterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field Filter (Recommended)</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || 'none'} // Use 'none' as default value
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a field filter (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No filter (include all fields)</SelectItem>
                          {fieldFilters.map((filter) => (
                            <SelectItem key={filter.id} value={filter.id}>
                              {filter.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="flex items-center justify-between">
                        <span>Choose which fields from N-central XML notifications to include</span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>


            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Integration</FormLabel>
                    <FormDescription>
                      Allow this integration to receive and relay notifications.
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
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitButtonText}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Expose the schema for parent components
IntegrationForm.schema = integrationSchema;
