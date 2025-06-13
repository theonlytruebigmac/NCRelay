"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { updateFieldFilterAction, getFieldFilterByIdAction } from "@/app/(app)/dashboard/filters/actions";
import { Loader2, Play, Filter, ListFilter } from "lucide-react";
import { BackButton } from "@/components/layout/BackButton";

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters.").max(50, "Name must not exceed 50 characters."),
  description: z.string().optional(),
  includedFields: z.array(z.string()).optional(),
  excludedFields: z.array(z.string()).optional(),
});

interface FieldData {
  name: string;
  value: string;
  included: boolean;
}

export default function EditFieldFilterPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null;
  const { toast } = useToast();


  
  const [xmlInput, setXmlInput] = useState("");
  const [extractedFields, setExtractedFields] = useState<FieldData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllFields, setShowAllFields] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      includedFields: [],
      excludedFields: [],
    },
  });

  const loadFieldFilter = async () => {
    if (!id) return;
    
    try {
      const filter = await getFieldFilterByIdAction(id);
      if (!filter) {
        toast({
          title: "Error",
          description: "Field filter not found",
          variant: "destructive",
        });
        router.push("/dashboard/filters");
        return;
      }

      // Update form values
      form.reset({
        name: filter.name,
        description: filter.description || "",
      });

      // Set sample data and extract fields
      if (filter.sampleData) {
        setXmlInput(filter.sampleData);
        await extractFieldsFromXml(filter.sampleData, filter.includedFields);
      }

    } catch (error) {
      console.error("Error loading field filter:", error);
      toast({
        title: "Error",
        description: "Failed to load field filter",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('Edit page mounted, id:', id);
    if (!id) {
      toast({
        title: "Error",
        description: "No filter ID provided",
        variant: "destructive",
      });
      router.push("/dashboard/filters");
      return;
    }
    
    loadFieldFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const extractFieldsFromXml = async (xml: string, included: string[] = []) => {
    setIsExtracting(true);
    
    try {
      const response = await fetch('/api/filters/extract-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: xml,
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.fields && result.extracted) {
        const fieldData = result.fields.map((field: string) => ({
          name: field,
          value: result.extracted[field] || "",
          included: included.length === 0 ? true : included.includes(field)
        }));
        
        setExtractedFields(fieldData);
        
        toast({
          title: "Fields extracted successfully",
          description: `Found ${fieldData.length} fields in the XML data.`,
        });
      } else {
        toast({
          title: "Failed to extract fields",
          description: result.error || "An unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error extracting fields:", error);
      toast({
        title: "Error extracting fields",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleToggleField = (fieldName: string, included: boolean) => {
    setExtractedFields(prev => 
      prev.map(field => 
        field.name === fieldName 
          ? { ...field, included }
          : field
      )
    );
  };

  const handleToggleAllFields = (included: boolean) => {
    setExtractedFields(prev => 
      prev.map(field => ({ ...field, included }))
    );
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!id) {
      toast({
        title: "Error",
        description: "No filter ID provided",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare included and excluded fields
      const includedFields = extractedFields
        .filter(field => field.included)
        .map(field => field.name);
        
      const excludedFields = extractedFields
        .filter(field => !field.included)
        .map(field => field.name);
      
      // Submit form with field data
      await updateFieldFilterAction(id, {
        ...values,
        includedFields,
        excludedFields,
        sampleData: xmlInput
      });
      
      toast({
        title: "Field filter updated successfully",
        description: "Changes have been saved.",
      });
      
      // Redirect to the field filters list page
      router.push("/dashboard/filters");
      router.refresh();
    } catch (error) {
      console.error("Error updating field filter:", error);
      toast({
        title: "Error updating field filter",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell
        title="Edit Field Filter"
        description="Loading..."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="col-span-1">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-8 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
                <div className="h-24 w-full bg-muted rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <BackButton href="/dashboard/filters" />
      <PageShell
        title="Edit Field Filter"
        description="Modify your field filter configuration"
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Field Filter Configuration
              </CardTitle>
              <CardDescription>Update which fields to include in your notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filter Name</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g., N-central Basic Filter" {...field} />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for your field filter
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
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="This filter includes essential fields for N-central notifications..."
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full sm:w-auto"
                    >
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListFilter className="h-5 w-5" />
                Field Selection
              </CardTitle>
              <CardDescription className="flex items-center justify-between">
                <span>Choose which fields to include in your notifications</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleToggleAllFields(true)}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleToggleAllFields(false)}
                  >
                    Deselect All
                  </Button>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="test">
                <TabsList className="mb-4">
                  <TabsTrigger value="test">Test XML</TabsTrigger>
                  <TabsTrigger value="fields">Field Selection</TabsTrigger>
                </TabsList>
                
                <TabsContent value="test" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Sample XML
                    </label>
                    <Textarea 
                      value={xmlInput}
                      onChange={(e) => setXmlInput(e.target.value)}
                      placeholder="Paste your XML here..."
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => extractFieldsFromXml(xmlInput)}
                      disabled={isExtracting}
                      className="flex items-center gap-2"
                    >
                      {isExtracting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Extract Fields
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="fields">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {extractedFields.filter(f => f.included).length} of {extractedFields.length} fields selected
                      </div>
                      <div className="flex items-center space-x-2">
                        <label htmlFor="show-all" className="text-sm">Show all fields</label>
                        <Checkbox 
                          id="show-all" 
                          checked={showAllFields}
                          onCheckedChange={(checked) => setShowAllFields(!!checked)} 
                        />
                      </div>
                    </div>
                    
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-2">
                        {extractedFields.map((field) => (
                          <div 
                            key={field.name}
                            className={`p-3 border rounded-md ${!showAllFields && !field.included ? 'hidden' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                id={`field-${field.name}`}
                                checked={field.included}
                                onCheckedChange={(checked) => handleToggleField(field.name, !!checked)}
                              />
                              <label 
                                htmlFor={`field-${field.name}`} 
                                className="text-sm font-medium flex-grow cursor-pointer"
                              >
                                {field.name}
                              </label>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground pl-6">
                              Value: <span className="font-mono">{field.value.substring(0, 100)}{field.value.length > 100 ? '...' : ''}</span>
                            </div>
                          </div>
                        ))}
                        
                        {extractedFields.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No fields extracted. Try the &quot;Extract Fields&quot; button with sample XML.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    </>
  );
}
