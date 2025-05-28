
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { IntegrationForm } from "@/components/dashboard/IntegrationForm";
import type { IntegrationFormValues } from "@/components/dashboard/IntegrationForm";
import { PageShell } from "@/components/layout/PageShell";
import { useToast } from "@/hooks/use-toast";
import type { Integration } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIntegrationByIdAction, updateIntegrationAction } from "../../actions";
import { useForm } from "react-hook-form"; // Import useForm
import { zodResolver } from "@hookform/resolvers/zod"; // If needed for schema

// Assuming IntegrationFormValues is the correct schema for the form
const pageSchema = IntegrationForm.schema; // Or your specific schema

export default function EditIntegrationPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const integrationId = params.id as string;

  // Initialize useForm here
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(pageSchema), // Or your specific schema
    // Default values will be set by reset(integration) in useEffect
  });

  useEffect(() => {
    if (integrationId) {
      setIsLoading(true);
      getIntegrationByIdAction(integrationId)
        .then((data) => {
          if (data) {
            setIntegration(data);
            form.reset(data); // Populate form with fetched data
          } else {
            toast({ variant: "destructive", title: "Error", description: "Integration not found." });
            router.replace("/dashboard/integrations");
          }
        })
        .catch((error) => {
          console.error("Failed to load integration:", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to load integration data." });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [integrationId, router, toast, form]);

  const handleSubmit = async (data: IntegrationFormValues) => {
    if (!integration) return;
    setIsSubmitting(true);
    form.clearErrors(); // Clear previous server errors

    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    const result = await updateIntegrationAction(integrationId, formData);

    if (result?.errors) {
      let hasSetFocus = false;
      Object.entries(result.errors).forEach(([fieldName, messages]) => {
        const fieldNameTyped = fieldName as keyof IntegrationFormValues;
        const message = (messages as string[]).join(", ");
        form.setError(fieldNameTyped, { type: "server", message });
        if (!hasSetFocus) {
          form.setFocus(fieldNameTyped);
          hasSetFocus = true;
        }
      });
      toast({ variant: "destructive", title: "Validation Error", description: "Please check form fields." });
    } else if (result?.error) {
      toast({ variant: "destructive", title: "Error", description: result.error });
    } else {
      toast({
        title: "Integration Updated",
        description: `Integration "${data.name}" has been successfully updated.`,
      });
      router.push("/dashboard/integrations");
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <PageShell title="Edit Integration" description="Modify your existing integration details.">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle><Skeleton className="h-7 w-1/4" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-1/4 self-end" />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!integration) {
    return (
      <PageShell title="Error" description="Integration could not be loaded.">
        <p>Please return to the integrations list.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Edit Integration: ${integration.name}`}
      description="Modify your existing integration details."
    >
      <IntegrationForm
        formInstance={form} // Pass the form instance
        initialData={integration} // Keep initialData for default values setup if needed by form
        onSubmit={handleSubmit} // Pass raw handler
        isSubmitting={isSubmitting}
        submitButtonText="Save Changes"
      />
    </PageShell>
  );
}
