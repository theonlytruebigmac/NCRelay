"use client";

import { IntegrationForm } from "@/components/dashboard/IntegrationForm";
import type { IntegrationFormValues } from "@/components/dashboard/IntegrationForm";
import { PageShell } from "@/components/layout/PageShell";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form"; // Import useForm
import { zodResolver } from "@hookform/resolvers/zod"; // If you have a schema for the page itself, or reuse integrationSchema
import { addIntegrationAction } from "../actions";
import { getFieldFiltersAction } from "../../filters/actions";
import type { FieldFilterConfig } from "@/lib/types";

// Assuming IntegrationFormValues is the correct schema for the form
// If not, define a schema here or import the one used by IntegrationForm
const pageSchema = IntegrationForm.schema; // Or your specific schema

export default function AddIntegrationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldFilters, setFieldFilters] = useState<FieldFilterConfig[]>([]);

  // Load field filters
  useEffect(() => {
    async function fetchFilters() {
      try {
        // Fetch field filters
        const fetchedFilters = await getFieldFiltersAction();
        setFieldFilters(fetchedFilters);
      } catch (error) {
        console.error("Failed to load filters:", error);
        toast({
          title: "Warning",
          description: "Failed to load some resources. Some options may be unavailable.",
          variant: "destructive",
        });
      }
    }
    fetchFilters();
  }, [toast]);

  // Initialize useForm here to pass the form instance to IntegrationForm
  // and to use form.setError
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(pageSchema), // Or your specific schema
    defaultValues: { // Ensure defaultValues match IntegrationFormValues
      name: "",
      platform: 'generic_webhook',
      webhookUrl: "",
      enabled: true,
      fieldFilterId: 'none',
    },
  });

  const handleSubmit = async (data: IntegrationFormValues) => {
    setIsSubmitting(true);
    form.clearErrors(); // Clear previous server errors

    // Convert the "none" value for fieldFilterId to undefined/null
    if (data.fieldFilterId === 'none') {
      data.fieldFilterId = undefined;
    }

    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const result = await addIntegrationAction(formData);

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
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please check the form fields for errors.",
      });
    } else if (result?.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error,
      });
    } else {
      toast({
        title: "Integration Created",
        description: `Integration "${data.name}" has been successfully created.`,
      });
      router.push("/dashboard/integrations");
    }
    setIsSubmitting(false);
  };

  return (
    <PageShell
      title="Add New Integration"
      description="Configure a new platform to relay notifications to."
    >
      {/* Pass the form instance to IntegrationForm */}
      <IntegrationForm
        formInstance={form} // Pass the form instance
        onSubmit={handleSubmit} // Pass raw handler
        isSubmitting={isSubmitting}
        submitButtonText="Create Integration"
        fieldFilters={fieldFilters}
      />
    </PageShell>
  );
}
