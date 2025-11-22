"use client";

import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, PlusCircle, Waypoints, Edit3, Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormControl, FormMessage, FormLabel } from "@/components/ui/form";
import { WebhookUrlField } from "@/components/ui/webhook-url-field";
import { UuidField } from "@/components/ui/uuid-field";
import { IpWhitelistManager } from "@/components/ui/ip-whitelist-manager";


type IntegrationForSelection = Pick<Integration, 'id' | 'name' | 'platform' | 'enabled'>;

const endpointFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters.").max(50, "Name must be at most 50 characters."),
  associatedIntegrationIds: z.array(z.string()),
  ipWhitelist: z.array(z.string()),
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
      ipWhitelist: [],
    },
  });

  const fetchPageData = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]); // Now fetchPageData includes toast in its dependencies

  // API Endpoint Functions
  const handleOpenEndpointDialog = (endpoint?: ApiEndpointConfig) => {
    form.reset(); // Clear previous form state and errors
    if (endpoint) {
      setEditingEndpoint(endpoint);
      form.setValue("name", endpoint.name);
      form.setValue("associatedIntegrationIds", Array.isArray(endpoint.associatedIntegrationIds) ? [...endpoint.associatedIntegrationIds] : []);
      form.setValue("ipWhitelist", Array.isArray(endpoint.ipWhitelist) ? [...endpoint.ipWhitelist] : []);
    } else {
      setEditingEndpoint(null);
      form.setValue("name", "");
      form.setValue("associatedIntegrationIds", []);
      form.setValue("ipWhitelist", []);
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
        values.ipWhitelist.forEach(ip => formData.append('ipWhitelist[]', ip));

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
            toast({ title: editingEndpoint ? "Endpoint Updated" : "Endpoint Created", description: `Endpoint &quot;${values.name}&quot; has been ${editingEndpoint ? 'updated' : 'added'}.` });
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
            toast({ title: "Endpoint Deleted", description: `Endpoint &quot;${endpointToDelete.name}&quot; has been removed.` });
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
      title="Endpoints Configuration"
      description="Define custom endpoints for receiving notifications."
    >
      <Card className="shadow-lg mb-6">
        <CardHeader className="flex flex-row items-start sm:items-center justify-between">
          <div>
            <CardTitle className="flex items-center"><Waypoints className="mr-2 h-5 w-5 text-primary"/>Endpoints</CardTitle>
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
             <p className="text-sm text-muted-foreground text-center py-4">No custom endpoints configured. Click &quot;Add Endpoint&quot; to create one.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Secure UUID Path</TableHead>
                    <TableHead>Full Endpoint URL</TableHead>
                    <TableHead>Associated Integrations</TableHead>
                    <TableHead>IP Whitelist</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiEndpoints.map((endpoint) => (
                    <TableRow key={endpoint.id}>
                      <TableCell className="font-medium whitespace-nowrap">{endpoint.name}</TableCell>
                      <TableCell>
                        <div className="min-w-[200px]">
                          <UuidField
                            value={endpoint.path}
                            showCopyButton={true}
                            className="font-mono text-sm"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[300px]">
                          <WebhookUrlField
                            value={`${origin}/api/custom/${endpoint.path}`}
                            disabled={true}
                            showCopyButton={true}
                            className="font-mono text-xs h-8"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{getAssociatedIntegrationsDisplay(endpoint.associatedIntegrationIds)}</TableCell>
                      <TableCell className="text-xs">
                        {endpoint.ipWhitelist && endpoint.ipWhitelist.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {endpoint.ipWhitelist.slice(0, 2).map((ip, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {ip}
                              </span>
                            ))}
                            {endpoint.ipWhitelist.length > 2 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                +{endpoint.ipWhitelist.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">All IPs allowed</span>
                        )}
                      </TableCell>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  render={() => ( // No field parameter needed since we're using custom checkbox implementation
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

                <FormField
                  control={form.control}
                  name="ipWhitelist"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IP Whitelist (Optional)</FormLabel>
                      <FormControl>
                        <IpWhitelistManager
                          ipList={field.value}
                          onIpListChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Restrict access to specific IP addresses. Leave empty to allow all IPs. Supports both IPv4 and IPv6 addresses. 
                        You can use <code>127.0.0.1</code>, <code>::1</code>, or <code>localhost</code> for local testing.
                      </p>
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
              This will permanently delete the endpoint &quot;{endpointToDelete?.name}&quot; (path: /api/custom/{endpointToDelete?.path}). This action cannot be undone.
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
          <CardTitle>Testing Your Endpoints</CardTitle>
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
