"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import type { LogEntry } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, XCircle, HelpCircle, ServerCrash, Trash2, RefreshCw, Play, Pause, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getRequestLogsAction, deleteLogEntryAction, deleteAllLogEntriesAction } from "./actions";
import { useToast } from "@/hooks/use-toast";
import { usePolling } from "@/hooks/use-polling";

const StatusIcon = ({ status }: { status: LogEntry['processingSummary']['overallStatus'] }) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'partial_failure':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    case 'total_failure':
      return <XCircle className="h-5 w-5 text-destructive" />;
    case 'no_integrations_triggered':
      return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
    default:
      return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function LogsPageClient() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async (showRefreshingIndicator = false) => {
    if (showRefreshingIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const fetchedLogs = await getRequestLogsAction();
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Failed to load logs:", error);
      if (!showRefreshingIndicator) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load logs. Please try again.",
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh polling
  usePolling(
    () => fetchLogs(true),
    {
      interval: 5000, // 5 seconds
      enabled: autoRefreshEnabled,
      immediate: false
    }
  );

  const handleManualRefresh = () => {
    fetchLogs(true);
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
    toast({
      title: autoRefreshEnabled ? "Auto-refresh disabled" : "Auto-refresh enabled",
      description: autoRefreshEnabled 
        ? "Logs will no longer refresh automatically" 
        : "Logs will refresh every 5 seconds",
    });
  };

  const handleDeleteLog = async (logId: string) => {
    setIsDeleting(logId);
    try {
      await deleteLogEntryAction(logId);
      setLogs(logs.filter(log => log.id !== logId));
      toast({
        title: "Log deleted",
        description: "The log entry has been successfully deleted.",
      });
    } catch (error) {
      console.error("Failed to delete log:", error);
      toast({
        title: "Error",
        description: "Failed to delete the log entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteAllLogs = async () => {
    setIsDeletingAll(true);
    try {
      await deleteAllLogEntriesAction();
      setLogs([]);
      toast({
        title: "All logs deleted",
        description: "All log entries have been successfully deleted.",
      });
    } catch (error) {
      console.error("Failed to delete all logs:", error);
      toast({
        title: "Error",
        description: "Failed to delete all log entries. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAll(false);
    }
  };
  
  const getStatusBadgeVariant = (status: LogEntry['processingSummary']['overallStatus']) => {
    switch (status) {
      case 'success': return 'default';
      case 'partial_failure': return 'outline';
      case 'total_failure': return 'destructive';
      case 'no_integrations_triggered': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <PageShell title="Request Logs" description="Inspect incoming requests and their relay status.">
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-7 w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Logging"
      description={`Inspect recent incoming requests and their relay status. ${autoRefreshEnabled ? ' - Auto-refreshing every 5 seconds' : ''}`}
    >
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              View Logs
              {isRefreshing && (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </CardTitle>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAutoRefresh}
            >
              {autoRefreshEnabled ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause Auto-refresh
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Auto-refresh
                </>
              )}
            </Button>
            {logs.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    disabled={isDeletingAll}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeletingAll ? "Deleting..." : "Delete All"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Log Entries</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all log entries from the database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAllLogs}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center min-h-[300px]">
              <ServerCrash className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-foreground">No logs found</h3>
              <div className="mt-2 mb-4 text-sm text-muted-foreground">
                Once requests are made to your API endpoints, they will appear here.
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-20rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Endpoint Name</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell><StatusIcon status={log.processingSummary.overallStatus} /></TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(parseISO(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>{log.apiEndpointName || "N/A"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.apiEndpointPath.startsWith("/api/custom/") 
                          ? "/api/custom/********" 
                          : log.apiEndpointPath}
                        <div className="text-xs text-gray-400">UUID hidden for security</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(log.processingSummary.overallStatus)}
                               className={log.processingSummary.overallStatus === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' : 
                                          log.processingSummary.overallStatus === 'partial_failure' ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : ''}
                        >
                          {log.processingSummary.overallStatus.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                        <span className="ml-2 text-xs text-muted-foreground">{log.processingSummary.message}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/logs/${log.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="mr-2 h-4 w-4" /> Details
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                disabled={isDeleting === log.id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {isDeleting === log.id ? "Deleting..." : "Delete"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Log Entry</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete this log entry from the database.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}