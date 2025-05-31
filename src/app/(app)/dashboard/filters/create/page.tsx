"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, UseFormReturn } from "react-hook-form";
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
import { createFieldFilterAction, getLogSamplesAction } from "../../filters/actions";
import { Loader2, Play, RefreshCw, Filter, ListFilter } from "lucide-react";
import { BackButton } from "@/components/layout/BackButton";

// Default sample XML for fallback when no logs exist
const defaultSampleXml = `<?xml version="1.0" encoding="UTF-8"?><notification>
  <ActiveNotificationTriggerID>1557534924</ActiveNotificationTriggerID>
  <CustomerName>Jasons Deli &gt; Morrisville</CustomerName>
  <DeviceName>SLS-2189 - JD's Probe</DeviceName>
  <DeviceURI>10.120.210.7</DeviceURI>
  <ExternalCustomerID/>
  <AffectedService>CPU</AffectedService>
  <TaskIdent/>
  <NcentralURI>sedemo.focusmsp.net</NcentralURI>
  <QualitativeOldState>Normal</QualitativeOldState>
  <QualitativeNewState>Failed</QualitativeNewState>
  <TimeOfStateChange>2025-05-29 22:05:10</TimeOfStateChange>
  <ProbeURI>10.120.210.7</ProbeURI>
  <QuantitativeNewState>CPU Usage: 14.00 %
Top Process 1: EPSecurityService
Top Process 2: AutomationManager.AgentService
Top Process 3: msp-agent-core
Top Process 4: System
Top Process 5: svchost
PID of Process 1: 3260
PID of Process 2: 4012
PID of Process 3: 1104
PID of Process 4: 4
PID of Process 5: 3000
User of Process 1: NT AUTHORITY\\SYSTEM
User of Process 2: NT AUTHORITY\\SYSTEM
User of Process 3: NT AUTHORITY\\SYSTEM
User of Process 4: NT AUTHORITY\\SYSTEM
User of Process 5: NT AUTHORITY\\SYSTEM
CPU Usage for Process 1: 2.00 %
CPU Usage for Process 2: 1.00 %
CPU Usage for Process 3: 1.00 %
CPU Usage for Process 4: 0.00 %
CPU Usage for Process 5: 0.00 %</QuantitativeNewState>
  <ServiceOrganizationName>Jasons Deli</ServiceOrganizationName>
</notification>`;

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters.").max(50, "Name must not exceed 50 characters."),
  description: z.string().optional(),
  includedFields: z.array(z.string()).optional(),
  excludedFields: z.array(z.string()).optional(),
  sampleXml: z.string().optional(),
});

interface FieldData {
  name: string;
  value: string;
  included: boolean;
}

interface TestXMLFormProps {
  form: UseFormReturn<z.infer<typeof formSchema>>;
  xmlInput: string;
  setXmlInput: (value: string) => void;
  extractFields: () => Promise<void>;
  isExtracting: boolean;
  loadSample: () => Promise<void>;
  isLoadingSample: boolean;
}

const TestXMLForm = ({ form, xmlInput, setXmlInput, extractFields, isExtracting, loadSample, isLoadingSample }: TestXMLFormProps) => (
  <div className="space-y-2">
    <FormField
      control={form.control}
      name="sampleXml"
      render={() => (
        <FormItem>
          <FormLabel>Sample XML</FormLabel>
          <FormControl>
            <Textarea 
              value={xmlInput}
              onChange={(e) => setXmlInput(e.target.value)}
              placeholder="Paste your XML here..."
              className="min-h-[300px] font-mono text-sm"
            />
          </FormControl>
        </FormItem>
      )}
    />
    
    <div className="flex items-center gap-2">
      <Button
        type="button"
        onClick={() => extractFields()}
        disabled={isExtracting}
        className="flex items-center gap-2"
      >
        {isExtracting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Extract Fields
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => loadSample()}
        disabled={isLoadingSample}
        className="flex items-center gap-2"
      >
        {isLoadingSample ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        Load Sample
      </Button>
    </div>
  </div>
);

interface FieldSelectionFormProps {
  extractedFields: FieldData[];
  showAllFields: boolean;
  setShowAllFields: (value: boolean) => void;
  handleToggleField: (name: string, included: boolean) => void;
  form: UseFormReturn<z.infer<typeof formSchema>>;
}

const FieldSelectionForm = ({
  extractedFields,
  showAllFields,
  setShowAllFields,
  handleToggleField
}: FieldSelectionFormProps) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {extractedFields.filter(f => f.included).length} of {extractedFields.length} fields selected
      </div>
      <div className="flex items-center space-x-2">
        <FormLabel htmlFor="show-all" className="text-sm">Show all fields</FormLabel>
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
);

export default function CreateFieldFilterPage() {
  const [xmlInput, setXmlInput] = useState(defaultSampleXml);
  const [extractedFields, setExtractedFields] = useState<FieldData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [showAllFields, setShowAllFields] = useState(true);
  const [logSamples, setLogSamples] = useState<string[]>([]);
  const [currentSampleIndex, setCurrentSampleIndex] = useState(-1);
  const { toast } = useToast();
  const router = useRouter();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      includedFields: [],
      excludedFields: []
    },
  });

  useEffect(() => {
    // Load log samples on component mount
    loadLogSamples();
    // Extract field information on component load
    extractFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const loadLogSamples = async () => {
    try {
      const samples = await getLogSamplesAction();
      setLogSamples(samples);
    } catch (error) {
      console.error('Failed to load log samples:', error);
      // Continue with default sample if log loading fails
    }
  };

  const loadSample = async () => {
    setIsLoadingSample(true);
    
    try {
      // If we have log samples, cycle through them
      if (logSamples.length > 0) {
        const nextIndex = (currentSampleIndex + 1) % logSamples.length;
        setCurrentSampleIndex(nextIndex);
        setXmlInput(logSamples[nextIndex]);
        
        toast({
          title: "Sample Loaded",
          description: `Loaded log sample ${nextIndex + 1} of ${logSamples.length}`,
        });
      } else {
        // Fallback to default sample if no logs available
        setXmlInput(defaultSampleXml);
        setCurrentSampleIndex(-1);
        
        toast({
          title: "Sample Loaded",
          description: "Loaded default sample XML (no logs available)",
        });
      }
    } catch (/* eslint-disable-next-line @typescript-eslint/no-unused-vars */ _error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load sample data.",
      });
    } finally {
      setIsLoadingSample(false);
    }
  }; 

  const extractFields = async () => {
    setIsExtracting(true);
    
    try {
      const response = await fetch('/api/filters/extract-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: xmlInput,
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.fields && result.extracted) {
        const fieldData = result.fields.map((field: string) => ({
          name: field,
          value: result.extracted[field] || "",
          included: true // All fields are included by default
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
      await createFieldFilterAction({
        ...values,
        includedFields,
        excludedFields,
        sampleData: xmlInput
      });
      
      toast({
        title: "Field filter created successfully",
        description: "You will now be redirected to the field filters page.",
      });
      
      // Redirect to the field filters list page
      router.push("/dashboard/filters");
      router.refresh();
    } catch (error) {
      console.error("Error creating field filter:", error);
      toast({
        title: "Error creating field filter",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <BackButton href="/dashboard/filters" />
      <PageShell
        title="Create Field Filter"
        description="Create a new field filter to select which data gets forwarded"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Field Filter Definition
                </CardTitle>
                <CardDescription>Configure which fields to include in your notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
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
                      Save Filter Configuration
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListFilter className="h-5 w-5" />
                  Select Fields
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>Choose which fields to include in your notifications</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleToggleAllFields(true)}
                    >
                      Select All
                    </Button>
                    <Button 
                      type="button"
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
                    <TestXMLForm
                      form={form}
                      xmlInput={xmlInput}
                      setXmlInput={setXmlInput}
                      extractFields={extractFields}
                      isExtracting={isExtracting}
                      loadSample={loadSample}
                      isLoadingSample={isLoadingSample}
                    />
                  </TabsContent>
                  
                  <TabsContent value="fields">
                    <FieldSelectionForm 
                      form={form}
                      extractedFields={extractedFields}
                      showAllFields={showAllFields}
                      setShowAllFields={setShowAllFields}
                      handleToggleField={handleToggleField}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </form>
        </Form>
      </PageShell>
    </>
  );
}
