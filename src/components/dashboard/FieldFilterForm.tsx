"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useState } from "react";
import { type FieldFilterConfig } from "@/lib/types";

const fieldFilterSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters."),
  description: z.string().optional(),
  includedFields: z.array(z.string()),
  excludedFields: z.array(z.string()),
  sampleData: z.string().optional(),
});

type FieldFilterFormValues = z.infer<typeof fieldFilterSchema>;

interface FieldFilterFormProps {
  initialData?: Partial<FieldFilterConfig>;
  onSubmit: (data: FieldFilterFormValues) => Promise<void>;
  isSubmitting?: boolean;
  submitButtonText?: string;
}

export function FieldFilterForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitButtonText = "Save Filter",
}: FieldFilterFormProps) {
  const [newField, setNewField] = useState("");

  const form = useForm<FieldFilterFormValues>({
    resolver: zodResolver(fieldFilterSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      includedFields: initialData?.includedFields || [],
      excludedFields: initialData?.excludedFields || [],
      sampleData: initialData?.sampleData || "",
    },
  });

  function addField(type: "included" | "excluded") {
    if (!newField.trim()) return;

    const field = newField.trim();
    const currentFields = form.getValues(type === "included" ? "includedFields" : "excludedFields");

    if (!currentFields.includes(field)) {
      form.setValue(
        type === "included" ? "includedFields" : "excludedFields",
        [...currentFields, field],
        { shouldValidate: true }
      );
    }

    setNewField("");
  }

  function removeField(field: string, type: "included" | "excluded") {
    const currentFields = form.getValues(type === "included" ? "includedFields" : "excludedFields");
    form.setValue(
      type === "included" ? "includedFields" : "excludedFields",
      currentFields.filter((f) => f !== field),
      { shouldValidate: true }
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filter Settings</CardTitle>
            <CardDescription>
              Configure which fields to include or exclude from notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Filter Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Production Alerts Filter" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name to identify this filter.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Filter for production alerts with essential fields only..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description of what this filter is used for.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Field Configuration</CardTitle>
            <CardDescription>
              Choose which fields to include or exclude from notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="includedFields"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Included Fields</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter a field name..."
                          value={newField}
                          onChange={(e) => setNewField(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addField("included");
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => addField("included")}
                        >
                          Add
                        </Button>
                      </div>
                      <ScrollArea className="h-24 rounded-md border p-2">
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((fieldName) => (
                            <Badge key={fieldName} variant="secondary">
                              {fieldName}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 hover:bg-secondary-foreground/10"
                                onClick={() => removeField(fieldName, "included")}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                          {field.value.length === 0 && (
                            <span className="text-sm text-muted-foreground">
                              No fields added. All fields will be included unless excluded.
                            </span>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </FormControl>
                  <FormDescription>
                    List specific fields to include. Leave empty to include all fields except excluded ones.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="excludedFields"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Excluded Fields</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter a field name..."
                          value={newField}
                          onChange={(e) => setNewField(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addField("excluded");
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => addField("excluded")}
                        >
                          Add
                        </Button>
                      </div>
                      <ScrollArea className="h-24 rounded-md border p-2">
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((fieldName) => (
                            <Badge key={fieldName} variant="destructive">
                              {fieldName}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 hover:bg-destructive-foreground/10"
                                onClick={() => removeField(fieldName, "excluded")}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                          {field.value.length === 0 && (
                            <span className="text-sm text-muted-foreground">
                              No fields excluded.
                            </span>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </FormControl>
                  <FormDescription>
                    List fields to exclude from notifications.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sample Data</CardTitle>
            <CardDescription>
              Optional: Add sample data to test this filter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="sampleData"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Paste sample XML data here..."
                      className="font-mono"
                      rows={10}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Paste sample XML data to test how this filter will process it.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {submitButtonText}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Export the schema for parent components to use
FieldFilterForm.schema = fieldFilterSchema;
