
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, SendHorizontal } from "lucide-react";
import type { SmtpSettings } from "@/lib/types";
import { 
  saveSmtpSettingsAction, 
  testSmtpSettingsAction 
} from "@/app/(app)/dashboard/settings/smtp/actions";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Define the schema locally as it's not exported from actions.ts anymore
const smtpSettingsSchema = z.object({
  host: z.string().min(1, "Host cannot be empty."),
  port: z.number().int().min(1, "Port must be a positive integer.").max(65535),
  user: z.string().min(1, "User cannot be empty."),
  password: z.string().optional(), // Password can be optional for some SMTP setups
  secure: z.boolean(),
  fromEmail: z.string().email("Invalid 'From Email' address."),
  appBaseUrl: z.string().url("App Base URL must be a valid URL (e.g., http://localhost:9002 or https://yourdomain.com)."),
});


type SmtpSettingsFormValues = z.infer<typeof smtpSettingsSchema>;

interface SmtpSettingsFormProps {
  initialData: SmtpSettings | null;
  onFormSubmit: () => void; // Callback to close dialog or re-fetch data
}

export function SmtpSettingsForm({ initialData, onFormSubmit }: SmtpSettingsFormProps) {
  const { toast } = useToast();
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  
  const form = useForm<SmtpSettingsFormValues>({
    resolver: zodResolver(smtpSettingsSchema),
    defaultValues: {
      host: initialData?.host || "",
      port: initialData?.port || 587,
      user: initialData?.user || "",
      password: initialData?.password || "",
      secure: initialData?.secure || false,
      fromEmail: initialData?.fromEmail || "",
      appBaseUrl: initialData?.appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : ""),
    },
  });

  const {formState: { isSubmitting } } = form;

  useEffect(() => {
    // Reset form if initialData changes (e.g., fetched after dialog open)
    form.reset({
      host: initialData?.host || "",
      port: initialData?.port || 587,
      user: initialData?.user || "",
      password: initialData?.password || "", // Password field should generally not be pre-filled from DB for security viewing
      secure: initialData?.secure || false,
      fromEmail: initialData?.fromEmail || "",
      appBaseUrl: initialData?.appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : ""),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  async function onSubmit(values: SmtpSettingsFormValues) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        formData.append(key, value ? 'true' : 'false');
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    
    form.clearErrors();
    const result = await saveSmtpSettingsAction(formData);

    if (result.success) {
      toast({ title: "Success", description: result.message || "SMTP settings saved." });
      onFormSubmit(); // Close dialog and potentially refresh parent page data
    } else {
      if (result.errors) {
        result.errors.forEach((err) => {
          form.setError(err.path.join(".") as keyof SmtpSettingsFormValues, {
            type: "server",
            message: err.message,
          });
        });
        toast({ variant: "destructive", title: "Validation Error", description: "Please check the form fields." });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message || "Failed to save SMTP settings." });
      }
    }
  }

  async function handleTestSmtp() {
    if (!form.getValues("host") || !form.getValues("user") || !form.getValues("fromEmail")) {
      toast({ 
        variant: "destructive", 
        title: "Missing Information", 
        description: "Please fill in host, user, and from email address fields first."
      });
      return;
    }

    if (!testEmail) {
      toast({ 
        variant: "destructive", 
        title: "Missing Test Email", 
        description: "Please provide an email address to send the test to."
      });
      return;
    }

    setIsTestingSmtp(true);
    
    try {
      const formData = new FormData();
      const values = form.getValues();
      
      // Add all SMTP settings
      Object.entries(values).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          formData.append(key, value ? 'true' : 'false');
        } else if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
      
      // Add test email
      formData.append('testEmail', testEmail);
      
      const result = await testSmtpSettingsAction(formData);
      
      if (result.success) {
        toast({ title: "SMTP Test Successful", description: result.message });
        setShowTestDialog(false);
      } else {
        toast({ variant: "destructive", title: "SMTP Test Failed", description: result.message });
      }
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "SMTP Test Error", 
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsTestingSmtp(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="host"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SMTP Host</FormLabel>
              <FormControl><Input placeholder="smtp.example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="port"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SMTP Port</FormLabel>
              <FormControl><Input type="number" placeholder="587" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="user"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SMTP User</FormLabel>
              <FormControl><Input placeholder="user@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SMTP Password</FormLabel>
              <FormControl><Input type="password" placeholder="••••••••" {...field} value={field.value ?? ''} /></FormControl>                      <FormDescription>Leave blank if your SMTP server doesn&apos;t require a password or if you don&apos;t want to change it.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="secure"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Use SSL/TLS (Secure)</FormLabel>
                <FormDescription>
                  Check if your SMTP server uses SSL/TLS (e.g., port 465).
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fromEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>From Email Address</FormLabel>
              <FormControl><Input type="email" placeholder="noreply@example.com" {...field} /></FormControl>
              <FormDescription>The email address password reset emails will be sent from.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="appBaseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Application Base URL</FormLabel>
              <FormControl><Input placeholder="https://your-app.com" {...field} /></FormControl>
              <FormDescription>Used to generate links in emails (e.g., password reset links). Include http/https.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end space-x-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setShowTestDialog(true)}
            className="flex items-center"
          >
            <SendHorizontal className="mr-2 h-4 w-4" />
            Test SMTP Settings
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save SMTP Settings
          </Button>
        </div>
      </form>

      {/* Test SMTP Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test SMTP Settings</DialogTitle>
            <DialogDescription>
              Enter an email address to send a test message. This will use your current SMTP settings without saving them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testEmail">Recipient Email</Label>
              <Input
                id="testEmail"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your-email@example.com"
                type="email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTestDialog(false)}
              disabled={isTestingSmtp}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleTestSmtp} 
              disabled={isTestingSmtp}
            >
              {isTestingSmtp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <SendHorizontal className="mr-2 h-4 w-4" />
                  Send Test Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
