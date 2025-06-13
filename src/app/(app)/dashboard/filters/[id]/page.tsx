import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { getFieldFilter } from "@/lib/field-filter-db";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Pencil, Filter } from "lucide-react";
import Link from "next/link";
import { DeleteFilterDialog } from "../DeleteFilterDialog";
import { BackButton } from "@/components/layout/BackButton";

export const dynamic = "force-dynamic";

import { FilterPageParams } from "./types";

export default async function FilterDetailsPage({ params }: FilterPageParams) {
  const resolvedParams = await params;

  // Validation handled by middleware, just need to check if we have an id
  if (!resolvedParams?.id) {
    console.error('Missing filter ID');
    notFound();
  }
  
  let filter;
  try {
    // Get the filter from the database
    filter = await getFieldFilter(resolvedParams.id);

    // Handle case where filter is not found
    if (!filter) {
      console.error(`Filter with ID ${resolvedParams.id} not found`);
      notFound();
    }

  } catch (error) {
    console.error('Error loading field filter:', error);
    throw error; // Let Next.js error boundary handle this
  }

  // Calculate how many fields would be included if processing an XML
  const includedFieldsCount = filter.includedFields.length || 
    `All except ${filter.excludedFields.length}`;

  return (
    <>
      <BackButton href="/dashboard/filters" />
      <PageShell
        title={filter.name}
        description="Field filter configuration details"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/dashboard/filters/${filter.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Filter
              </Link>
            </Button>
            <DeleteFilterDialog filterId={filter.id} filterName={filter.name} />
          </div>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter Configuration
              </CardTitle>
              <CardDescription>
                Created on {format(new Date(filter.createdAt), "MMMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filter.description && (
                  <div>
                    <h3 className="text-sm font-medium">Description</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {filter.description}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium">Field Selection</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {typeof includedFieldsCount === 'number' 
                      ? `${includedFieldsCount} fields included`
                      : includedFieldsCount}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Last Updated</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(filter.updatedAt), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Field Configuration</CardTitle>
              <CardDescription>
                Fields that will be included or excluded from your notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="included">
                <TabsList className="mb-4">
                  <TabsTrigger value="included">
                    Included Fields ({filter.includedFields.length || "All"})
                  </TabsTrigger>
                  <TabsTrigger value="excluded">
                    Excluded Fields ({filter.excludedFields.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="included">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {filter.includedFields.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          All fields are included by default, except those in the excluded list.
                        </p>
                      ) : (
                        filter.includedFields.map((field: string) => (
                          <div
                            key={field}
                            className="flex items-center p-2 rounded-md border"
                          >
                            <Checkbox checked disabled />
                            <span className="ml-2 text-sm font-medium">{field}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="excluded">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {filter.excludedFields.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          No fields are explicitly excluded.
                        </p>
                      ) : (
                        filter.excludedFields.map((field: string) => (
                          <div
                            key={field}
                            className="flex items-center p-2 rounded-md border"
                          >
                            <Checkbox checked={false} disabled />
                            <span className="ml-2 text-sm font-medium">{field}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {filter.sampleData && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Sample Data</CardTitle>
                <CardDescription>
                  The sample data used to create this filter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-muted rounded-md overflow-auto text-xs">
                  {filter.sampleData}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </PageShell>
    </>
  );
}
