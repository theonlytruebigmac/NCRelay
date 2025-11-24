"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Filter, Plus, Edit3, Trash2, Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { getFieldFiltersAction, deleteFieldFilterAction } from "./actions";
import type { FieldFilterConfig } from "@/lib/types";

export default function FilterListPage() {
  const [filters, setFilters] = useState<FieldFilterConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterToDelete, setFilterToDelete] = useState<string | null>(null);
  const [isPending, setPending] = useState(false);
  const { toast } = useToast();
  const { can } = usePermissions();
  
  const canCreate = can('field_filters', 'create');
  const canUpdate = can('field_filters', 'update');
  const canDelete = can('field_filters', 'delete');

  useEffect(() => {
    loadFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFilters() {
    try {
      const data = await getFieldFiltersAction();
      setFilters(data);
    } catch (/* eslint-disable-next-line @typescript-eslint/no-unused-vars */ error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load field filters.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleDelete = async () => {
    if (!filterToDelete) return;

    setPending(true);
    try {
      await deleteFieldFilterAction(filterToDelete);
      setFilters(filters.filter(f => f.id !== filterToDelete));
      toast({
        title: "Success",
        description: "Field filter deleted successfully.",
      });
    } catch (/* eslint-disable-next-line @typescript-eslint/no-unused-vars */ error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete field filter.",
      });
    } finally {
      setFilterToDelete(null);
      setPending(false);
    }
  };
  
  return (
    <PageShell
      title="Field Filters Configuration"
      description="Manage which fields are included in notifications"
      actions={
        canCreate ? (
          <Button asChild>
            <Link href="/dashboard/filters/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Filter
            </Link>
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-1/4 bg-muted rounded" />
                <div className="h-4 w-1/3 bg-muted rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-1/2 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filters.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Filter className="h-16 w-16 mb-4 text-muted-foreground" />
          <h2 className="text-xl font-medium mb-2">No Field Filters Yet</h2>
          <p className="text-muted-foreground mb-6">
            {canCreate 
              ? "Create your first field filter to customize which data is forwarded from N-central notifications"
              : "No field filters have been created yet. Contact an administrator to create filters."}
          </p>
          {canCreate && (
            <Button asChild>
              <Link href="/dashboard/filters/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Filter
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filters.map((filter) => (
            <Card key={filter.id} className="flex flex-col h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {filter.name}
                  </CardTitle>
                </div>
                <CardDescription>
                  {filter.includedFields.length > 0 
                    ? `${filter.includedFields.length} fields included` 
                    : `All fields included except ${filter.excludedFields.length} excluded`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="space-y-4">
                  {filter.description && (
                    <p className="text-muted-foreground text-sm">{filter.description}</p>
                  )}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold mb-2">Included Fields</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {filter.includedFields.slice(0, 5).map((field) => (
                          <Badge key={field} variant="secondary" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                        {filter.includedFields.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{filter.includedFields.length - 5} more
                          </Badge>
                        )}
                        {filter.includedFields.length === 0 && (
                          <span className="text-xs text-muted-foreground">All fields included</span>
                        )}
                      </div>
                    </div>
                    {filter.excludedFields.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2">Excluded Fields</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {filter.excludedFields.slice(0, 3).map((field) => (
                            <Badge key={field} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                          {filter.excludedFields.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{filter.excludedFields.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-6">
                <div className="flex justify-between items-center w-full">
                  <div className="text-xs text-muted-foreground">
                    Updated {format(new Date(filter.updatedAt), "MMM d, yyyy")}
                  </div>
                  <div className="flex gap-2">
                    {canUpdate && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link 
                          href={`/dashboard/filters/${filter.id}/edit`} 
                          className="flex items-center gap-2"
                          onClick={(e) => {
                            console.log('Edit button clicked for filter:', filter.id);
                            // Don't prevent default - let the navigation happen
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                          <span>Edit</span>
                        </Link>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterToDelete(filter.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!filterToDelete} onOpenChange={() => setFilterToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this field filter. Any integrations using this filter will revert to including all fields.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
