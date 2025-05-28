
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
import type { Integration, Platform } from "@/lib/types";
import { platformOptions } from "@/lib/platform-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMemo, useEffect } from "react"; // Added useEffect

const integrationSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }).max(50),
  platform: z.enum(['slack', 'discord', 'teams', 'generic_webhook']),
  webhookUrl: z.string().url({ message: "Invalid webhook URL." }),
  enabled: z.boolean().default(true),
  targetFormat: z.enum(['json', 'xml', 'text']).default('json'),
});

export type IntegrationFormValues = z.infer<typeof integrationSchema>;

interface IntegrationFormProps {
  initialData?: Partial<Integration>; // Keep for initial population if formInstance is not used for that
  onSubmit: (data: IntegrationFormValues) => Promise<void>; // Raw handler that receives form data
  isSubmitting?: boolean;
  submitButtonText?: string;
  formInstance?: UseFormReturn<IntegrationFormValues>; // Prop to receive form instance
}

// Export the schema so parent pages can use it with their useForm hook
export const IntegrationFormSchema = integrationSchema;


export function IntegrationForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitButtonText = "Save Integration",
  formInstance // Receive the form instance from parent
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
      targetFormat: initialData?.targetFormat || 'json',
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

  const targetFormatOptions = useMemo(() => {
    let recommendedFormat = 'json'; // Default recommendation
    switch (selectedPlatform) {
      case 'slack':
      case 'discord':
      case 'teams':
        recommendedFormat = 'text';
        return [
          { value: "text", label: "Plain Text" },
          { value: "json", label: "JSON (For Advanced Formatting)" },
          { value: "xml", label: "XML Passthrough" },
        ];
      case 'generic_webhook':
      default:
        return [
          { value: "json", label: "JSON (Recommended for generic webhooks)" },
          { value: "xml", label: "XML (Passthrough)" },
          { value: "text", label: "Plain Text (Basic content extraction)" },
        ];
    }
  }, [selectedPlatform]);

  // Effect to update targetFormat when platform changes, if the current one isn't ideal
  useEffect(() => {
    const currentTargetFormat = form.getValues('targetFormat');
    let idealFormat: 'json' | 'xml' | 'text' = 'json';
    if (selectedPlatform === 'slack' || selectedPlatform === 'discord' || selectedPlatform === 'teams') {
      idealFormat = 'text';
    }
    // Only change if the current format is not one of the specific recommendations for these platforms
    if ((selectedPlatform === 'slack' || selectedPlatform === 'discord' || selectedPlatform === 'teams') && currentTargetFormat === 'xml') {
      form.setValue('targetFormat', idealFormat, { shouldValidate: true });
    } else if (selectedPlatform === 'generic_webhook' && currentTargetFormat !== 'json' && currentTargetFormat !== 'xml' && currentTargetFormat !== 'text' ) {
      // If it's generic and somehow an invalid format was set
      form.setValue('targetFormat', 'json', { shouldValidate: true });
    }

  }, [selectedPlatform, form]);


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
                    <Input type="url" placeholder="https://hooks.slack.com/services/..." {...field} />
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
                <FormField
                  control={form.control}
                  name="targetFormat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Format</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select target format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {targetFormatOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The format NCRelay will send to the webhook. Basic server-side transformations will be applied.
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
