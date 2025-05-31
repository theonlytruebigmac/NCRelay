
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/PageShell";
import type { Integration } from "@/lib/types";
import { IntegrationCard } from "@/components/dashboard/IntegrationCard";
import { PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"; // Assuming Card related imports were meant to be here
import { getIntegrationsAction, deleteIntegrationAction, toggleIntegrationEnabledAction } from "./actions";


function WebhookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 12.5V10a2 2 0 0 0-2-2h-4.5A2.5 2.5 0 0 1 9 5.5V3" />
      <path d="M9 3a2.5 2.5 0 0 1 2.5-2.5H17a2 2 0 0 1 2 2v1.5" />
      <path d="M12.5 18H10a2 2 0 0 0-2 2v4.5A2.5 2.5 0 0 1 5.5 21V12" />
      <path d="M21 12v8.5a2.5 2.5 0 0 1-2.5 2.5H17a2 2 0 0 1-2-2v-4" />
    </svg>
  )
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // For delete button loading state
  const [isToggling, setIsToggling] = useState<string | null>(null); // Store ID of integration being toggled
  const { toast } = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();


  async function fetchIntegrations() {
    setIsLoading(true);
    try {
      const fetchedIntegrations = await getIntegrationsAction();
      setIntegrations(fetchedIntegrations);
    } catch (error) {
      console.error("Failed to load integrations:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load integrations.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchIntegrations();
    // toast is not actually used in fetchIntegrations, so it doesn't need to be a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    setIsToggling(id);
    // Optimistic update can be tricky with revalidatePath, let's wait for server
    // const originalIntegrations = [...integrations];
    // const optimisticUpdate = integrations.map((int) =>
    //   int.id === id ? { ...int, enabled } : int
    // );
    // setIntegrations(optimisticUpdate);

    const result = await toggleIntegrationEnabledAction(id, enabled);
    if (result?.error) {
      // setIntegrations(originalIntegrations); // Revert on error if optimistic update was used
      toast({ variant: "destructive", title: "Error", description: result.error });
    } else {
      toast({
        title: `Integration ${enabled ? "Enabled" : "Disabled"}`,
        description: `Integration "${integrations.find(int => int.id === id)?.name}" has been ${enabled ? "enabled" : "disabled"}.`,
      });
      // Re-fetch or rely on revalidatePath
      startTransition(() => {
        fetchIntegrations();
      });
    }
    setIsToggling(null);
  };

  const handleEdit = (id: string) => {
    router.push(`/dashboard/integrations/${id}/edit`);
  };
  
  const confirmDelete = (integration: Integration) => {
    setIntegrationToDelete(integration);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!integrationToDelete) return;
    
    setIsDeleting(true);
    const result = await deleteIntegrationAction(integrationToDelete.id);
    setIsDeleting(false);

    if (result?.error) {
       toast({ variant: "destructive", title: "Error", description: result.error });
    } else {
       toast({
        title: "Integration Deleted",
        description: `Integration "${integrationToDelete.name}" has been deleted.`,
      });
      // Re-fetch or rely on revalidatePath
      startTransition(() => {
        fetchIntegrations();
      });
    }
    setShowDeleteDialog(false);
    setIntegrationToDelete(null);
  };

  if (isLoading) {
    return (
      <PageShell title="Integrations" description="Manage your connections to messaging platforms.">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter className="mt-auto border-t pt-4 flex justify-between">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Integrations Configuration"
      description="Manage your connections to messaging platforms."
      actions={
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/dashboard/integrations/add">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Integration
          </Link>
        </Button>
      }
    >
      {integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center min-h-[400px]">
          <WebhookIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold text-foreground">No integrations yet</h3>
          <p className="mt-2 mb-4 text-sm text-muted-foreground">
            Get started by adding your first integration.
          </p>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/dashboard/integrations/add">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Integration
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onToggleEnabled={handleToggleEnabled}
              onEdit={handleEdit}
              onDelete={() => confirmDelete(integration)}
              isToggling={isToggling === integration.id}
            />
          ))}
        </div>
      )}
       <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {if (!open && !isDeleting) setIntegrationToDelete(null); setShowDeleteDialog(open)}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-6 w-6 text-destructive" />
              Are you sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the integration
              &quot;{integrationToDelete?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIntegrationToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
