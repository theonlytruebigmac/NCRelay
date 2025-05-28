
"use client";

import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, PlusCircle, AlertTriangle, Info, Waypoints, Edit3, Loader2 } from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiEndpointConfig, Integration, Platform } from "@/lib/types";
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { platformNames } from "@/lib/platform-helpers";
import { 
    getApiEndpointsAction, 
    addApiEndpointAction, 
    updateApiEndpointAction, 
    deleteApiEndpointAction,
    getIntegrationsForEndpointSelectionAction
} from "./actions";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormControl, FormMessage, FormLabel } from "@/components/ui/form";


type IntegrationForSelection = Pick<Integration, 'id' | 'name' | 'platform' | 'enabled'>;

const endpointFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters.").max(50, "Name must be at most 50 characters."),
  associatedIntegrationIds: z.array(z.string()).default([]),
});

export type EndpointFormValues = z.infer<typeof endpointFormSchema>;


export default function ApiEndpointsPage() {
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpointConfig[]>([]);
  const [integrationsForSelection, setIntegrationsForSelection] = useState<IntegrationForSelection[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // State for API Endpoint Management
  const [showEndpointDialog, setShowEndpointDialog] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<ApiEndpointConfig | null>(null);
  
  const [endpointToDelete, setEndpointToDelete] = useState<ApiEndpointConfig | null>(null);
  const [showDeleteEndpointConfirmDialog, setShowDeleteEndpointConfirmDialog] = useState(false);

  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const form = useForm<EndpointFormValues>({
    resolver: zodResolver(endpointFormSchema),
    defaultValues: {
      name: "",
      associatedIntegrationIds: [],
    },
  });


  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const [endpoints, integrations] = await Promise.all([
        getApiEndpointsAction(),
        getIntegrationsForEndpointSelectionAction()
      ]);
      setApiEndpoints(endpoints);
      setIntegrationsForSelection(integrations);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({ variant: "destructive", title: "Error Loading Data", description: "Could not load configurations."});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, [toast]); // Removed fetchPageData from dependency array to avoid re-fetch on its own change

  // API Endpoint Functions
  const handleOpenEndpointDialog = (endpoint?: ApiEndpointConfig) => {
    form.reset(); // Clear previous form state and errors
    if (endpoint) {
      setEditingEndpoint(endpoint);
      form.setValue("name", endpoint.name);
      form.setValue("associatedIntegrationIds", Array.isArray(endpoint.associatedIntegrationIds) ? [...endpoint.associatedIntegrationIds] : []);
    } else {
      setEditingEndpoint(null);
      form.setValue("name", "");
      form.setValue("associatedIntegrationIds", []);
    }
    setShowEndpointDialog(true);
  };
  
  const handleToggleIntegrationForEndpoint = (integrationId: string) => {
    const currentIds = form.getValues("associatedIntegrationIds");
    const newIds = currentIds.includes(integrationId)
      ? currentIds.filter(id => id !== integrationId)
      : [...currentIds, integrationId];
    form.setValue("associatedIntegrationIds", newIds, { shouldValidate: true });
  };

  const onSubmitEndpointForm = async (values: EndpointFormValues) => {
    startTransition(async () => {
        const formData = new FormData();
        formData.append('name', values.name);
        values.associatedIntegrationIds.forEach(id => formData.append('associatedIntegrationIds[]', id));

        form.clearErrors();

        const action = editingEndpoint ? updateApiEndpointAction.bind(null, editingEndpoint.id) : addApiEndpointAction;
        const result = await action(formData);

        if (result?.errors) {
            let hasSetFocus = false;
            Object.entries(result.errors).forEach(([fieldName, messages]) => {
                const fieldNameTyped = fieldName as keyof EndpointFormValues;
                const message = (messages as string[]).join(", ");
                form.setError(fieldNameTyped, { type: "server", message });
                if (!hasSetFocus) {
                    form.setFocus(fieldNameTyped);
                    hasSetFocus = true;
                }
            });
            toast({ variant: "destructive", title: "Validation Error", description: "Please check form fields."});
        } else if (result?.error) {
            toast({ variant: "destructive", title: "Error", description: result.error });
        } else {
            toast({ title: editingEndpoint ? "Endpoint Updated" : "Endpoint Created", description: `Endpoint "${values.name}" has been ${editingEndpoint ? 'updated' : 'added'}.` });
            setShowEndpointDialog(false);
            setEditingEndpoint(null);
            fetchPageData(); // Re-fetch data
        }
    });
  };

  const handleDeleteEndpoint = (endpoint: ApiEndpointConfig) => {
    setEndpointToDelete(endpoint);
    setShowDeleteEndpointConfirmDialog(true);
  };

  const confirmDeleteEndpoint = () => {
    if (!endpointToDelete) return;
    startTransition(async () => {
        const result = await deleteApiEndpointAction(endpointToDelete.id);
        if (result?.error) {
            toast({ variant: "destructive", title: "Error", description: result.error });
        } else {
            toast({ title: "Endpoint Deleted", description: `Endpoint "${endpointToDelete.name}" has been removed.` });
            fetchPageData(); // Re-fetch data
        }
        setShowDeleteEndpointConfirmDialog(false);
        setEndpointToDelete(null);
    });
  };
  
  const getAssociatedIntegrationsDisplay = (ids: string[]): string => {
    if (!ids || ids.length === 0) return 'None';
    if (ids.length === 1) return '1 integration';
    return `${ids.length} integrations`;
  };

  return (
    <PageShell
      title="API Endpoints Configuration"
      description="Define custom API endpoints for receiving notifications."
    >
      <Alert className="mb-6 shadow">
        <Info className="h-5 w-5" />
        <AlertTitle>How Custom API Endpoints Work</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Create unique URLs (e.g., <code>{origin}/api/custom/your-path</code>) to receive data.</li>
            <li>Each endpoint can be configured to trigger specific integrations.</li>
            <li>All endpoints are public.</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card className="shadow-lg mb-6">
        <CardHeader className="flex flex-row items-start sm:items-center justify-between">
          <div>
            <CardTitle className="flex items-center"><Waypoints className="mr-2 h-5 w-5 text-primary"/>Custom API Endpoints</CardTitle>
            <CardDescription>
              Define and manage your incoming notification endpoints.
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenEndpointDialog()} className="bg-primary hover:bg-primary/90 mt-2 sm:mt-0 shrink-0" disabled={isPending}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Endpoint
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : apiEndpoints.length === 0 ? (
             <p className="text-sm text-muted-foreground text-center py-4">No custom endpoints configured. Click "Add Endpoint" to create one.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Secure UUID Path</TableHead>
                    <TableHead>Full Endpoint URL</TableHead>
                    <TableHead>Associated Integrations</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiEndpoints.map((endpoint) => (
                    <TableRow key={endpoint.id}>
                      <TableCell className="font-medium whitespace-nowrap">{endpoint.name}</TableCell>
                      <TableCell className="font-mono text-sm">{endpoint.path}</TableCell>
                      <TableCell>
                         <div className="flex items-center space-x-1 min-w-[300px]">
                          <Input
                            type="text"
                            readOnly
                            value={`${origin}/api/custom/${endpoint.path}`}
                            className="font-mono text-xs h-8 flex-grow"
                            aria-label="Full Endpoint URL"
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                                navigator.clipboard.writeText(`${origin}/api/custom/${endpoint.path}`);
                                toast({title: "Endpoint URL Copied!"});
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{getAssociatedIntegrationsDisplay(endpoint.associatedIntegrationIds)}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(endpoint.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button variant="outline" size="icon" onClick={() => handleOpenEndpointDialog(endpoint)} className="h-9 w-9" disabled={isPending}><Edit3 className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteEndpoint(endpoint)} className="h-9 w-9" disabled={isPending}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={showEndpointDialog} onOpenChange={(open) => { if(!open && !isPending) { form.reset(); setEditingEndpoint(null); } setShowEndpointDialog(open); }}>
        <DialogContent className="sm:max-w-lg">
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEndpointForm)} className="space-y-6">
                <DialogHeader>
                  <DialogTitle>{editingEndpoint ? "Edit" : "Add New"} API Endpoint</DialogTitle>
                  <DialogDescription>Configure a custom endpoint name and linked integrations. The endpoint path will use a secure, randomly generated UUID to prevent enumeration attacks.</DialogDescription>
                </DialogHeader>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
                      <FormLabel className="text-right">Name</FormLabel>
                      <FormControl className="col-span-3">
                        <Input placeholder="e.g., N-Central Alerts" {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage className="col-span-3 col-start-2" />
                    </FormItem>
                  )}
                />

                {/* Show the secure endpoint path - either existing UUID or note about auto-generation */}
                <div className="grid grid-cols-4 items-start gap-x-4 gap-y-1">
                  <div className="text-right pt-2 text-sm font-medium">Endpoint URL</div>
                  <div className="col-span-3">
                    <div className="flex items-center">
                      <span className="text-sm text-muted-foreground p-2 bg-muted rounded-l-md border border-input border-r-0 whitespace-nowrap overflow-hidden text-ellipsis flex-initial max-w-[50%]" title={`${origin}/api/custom/`}>
                        {`${origin}/api/custom/`.length > 25 ? `...${`${origin}/api/custom/`.slice(-22)}` : `${origin}/api/custom/`}
                      </span>
                      <div className="p-2 bg-secondary/50 border border-input border-l-0 rounded-r-md flex-grow text-sm text-muted-foreground">
                        {editingEndpoint ? editingEndpoint.path : "🔒 Secure UUID will be generated"}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {editingEndpoint ? "Secure UUID path cannot be changed for security." : "A random, secure UUID will be generated automatically to prevent enumeration attacks."}
                    </p>
                  </div>
                </div>
                
                <FormField
                  control={form.control}
                  name="associatedIntegrationIds"
                  render={({ field }) => ( // field is not directly used here as Checkbox group is custom
                    <FormItem>
                      <FormLabel>Associated Integrations</FormLabel>
                      {integrationsForSelection.length === 0 ? (
                        <p className="text-sm text-muted-foreground mt-2">
                          No integrations available. Please <Link href="/dashboard/integrations/add" className="text-primary hover:underline">add an integration</Link> first.
                        </p>
                      ) : (
                        <ScrollArea className="h-40 mt-2 rounded-md border p-2">
                          {integrationsForSelection.map(integration => (
                            <div key={integration.id} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded-md">
                              <Checkbox 
                                id={`integration-${integration.id}-${editingEndpoint?.id || 'new'}`} // Ensure unique ID for checkbox
                                checked={form.watch("associatedIntegrationIds").includes(integration.id)}
                                onCheckedChange={() => handleToggleIntegrationForEndpoint(integration.id)}
                                disabled={!integration.enabled || isPending}
                              />
                              <Label 
                                htmlFor={`integration-${integration.id}-${editingEndpoint?.id || 'new'}`} 
                                className={`text-sm font-normal cursor-pointer ${!integration.enabled ? 'text-muted-foreground line-through' : ''}`}
                              >
                                {integration.name} ({typeof integration.platform === 'string' ? platformNames[integration.platform as Platform] : 'N/A'}) {!integration.enabled && "(Disabled)"}
                              </Label>
                            </div>
                          ))}
                        </ScrollArea>
                      )}
                       <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isPending}>Cancel</Button></DialogClose>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingEndpoint ? "Save Changes" : "Create Endpoint"}
                  </Button>
                </DialogFooter>
            </form>
           </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteEndpointConfirmDialog} onOpenChange={setShowDeleteEndpointConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="mr-2 h-6 w-6 text-destructive" />Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the endpoint "{endpointToDelete?.name}" (path: /api/custom/{endpointToDelete?.path}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEndpointToDelete(null)} disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEndpoint} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Endpoint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle>Testing Your Custom Endpoints</CardTitle>
          <CardDescription>
            Use a tool like cURL or Postman to test your configured API endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-1">Example cURL command:</p>
          <p className="text-xs text-muted-foreground mb-2">Replace <code>your-endpoint-uuid</code> with the UUID from one of your configured endpoints above.</p>
          <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {`curl -X POST \\
  ${origin}/api/custom/your-endpoint-uuid \\
  -H 'Content-Type: application/xml' \\
  -d '<notification><message>Test via custom endpoint!</message></notification>'`}
          </pre>
        </CardContent>
      </Card>
    </PageShell>
  );
}
