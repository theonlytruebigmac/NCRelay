
"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import type { LogEntry, LoggedIntegrationAttempt } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, AlertCircle, CheckCircle, XCircle, HelpCircle, ServerCrash, Trash2, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Skeleton } from "@/components/ui/skeleton";
import { getRequestLogsAction, deleteLogEntryAction, deleteAllLogEntriesAction } from "./actions"; // Updated import
import { useToast } from "@/hooks/use-toast";

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

const IntegrationStatusIcon = ({ status }: { status: LoggedIntegrationAttempt['status'] }) => {
   switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed_transformation':
    case 'failed_relay':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'skipped_disabled':
    case 'skipped_no_association': // This status might be less relevant now
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchLogs() {
      setIsLoading(true);
      try {
        const fetchedLogs = await getRequestLogsAction();
        // Sorting is handled by DB query (ORDER BY timestamp DESC)
        setLogs(fetchedLogs);
      } catch (error) {
        console.error("Failed to load logs:", error);
        // Optionally show a toast error
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const handleViewDetails = (log: LogEntry) => {
    setSelectedLog(log);
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
  
  const getIntegrationStatusBadgeVariant = (status: LoggedIntegrationAttempt['status']) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed_transformation':
      case 'failed_relay': 
        return 'destructive';
      case 'skipped_disabled':
      case 'skipped_no_association':
        return 'secondary';
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
      title="Request Logs"
      description="Inspect incoming requests and their relay status. (Last 50 entries)"
    >
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Request Logs</CardTitle>
            <CardDescription>
              Recent webhook requests and their processing status
            </CardDescription>
          </div>
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
        </CardHeader>
        <CardContent className="pt-6">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center min-h-[300px]">
              <ServerCrash className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-foreground">No logs found</h3>
              <p className="mt-2 mb-4 text-sm text-muted-foreground">
                Once requests are made to your API endpoints, they will appear here.
              </p>
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
                      <TableCell className="font-mono text-xs">{log.apiEndpointPath}</TableCell>
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
                          <Dialog onOpenChange={(open) => !open && setSelectedLog(null)}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(log)}>
                                <Eye className="mr-2 h-4 w-4" /> Details
                              </Button>
                            </DialogTrigger>
                            {selectedLog && selectedLog.id === log.id && (
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle>Log Details: {selectedLog.apiEndpointName || selectedLog.apiEndpointPath}</DialogTitle>
                                <DialogDescription>
                                  {format(parseISO(selectedLog.timestamp), "MMM d, yyyy HH:mm:ss zzz")}
                                </DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="max-h-[70vh] pr-6">
                                <div className="space-y-6 py-4">
                                  <Card>
                                    <CardHeader><CardTitle className="text-lg">Incoming Request</CardTitle></CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                      <p><strong>IP:</strong> {selectedLog.incomingRequest.ip || "N/A"}</p>
                                      <p><strong>Method:</strong> {selectedLog.incomingRequest.method}</p>
                                      <div>
                                        <strong>Headers:</strong>
                                        <SyntaxHighlighter language="json" style={atomDark} customStyle={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }} className="rounded-md">
                                          {JSON.stringify(selectedLog.incomingRequest.headers, null, 2)}
                                        </SyntaxHighlighter>
                                      </div>
                                      <div>
                                        <strong>Raw Body (XML):</strong>
                                        <SyntaxHighlighter language="xml" style={atomDark} customStyle={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }} className="rounded-md">
                                          {selectedLog.incomingRequest.bodyRaw}
                                        </SyntaxHighlighter>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader><CardTitle className="text-lg">Processing Summary</CardTitle></CardHeader>
                                    <CardContent className="space-y-1 text-sm">
                                       <p><strong>Overall Status:</strong> 
                                        <Badge 
                                            variant={getStatusBadgeVariant(selectedLog.processingSummary.overallStatus)}
                                            className={`ml-2 ${selectedLog.processingSummary.overallStatus === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' : 
                                                       selectedLog.processingSummary.overallStatus === 'partial_failure' ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : ''}`}
                                        >
                                            {selectedLog.processingSummary.overallStatus.replace(/_/g, ' ').toUpperCase()}
                                        </Badge>
                                       </p>
                                      <p><strong>Message:</strong> {selectedLog.processingSummary.message}</p>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader><CardTitle className="text-lg">Integration Attempts ({selectedLog.integrations.length})</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                      {selectedLog.integrations.length === 0 ? <p className="text-sm text-muted-foreground">No integrations were attempted.</p> : null}
                                      {selectedLog.integrations.map((attempt, idx) => (
                                        <Card key={idx} className="bg-muted/30">
                                          <CardHeader className="pb-2 pt-4">
                                            <CardTitle className="text-base flex items-center">
                                              <IntegrationStatusIcon status={attempt.status}/>
                                              <span className="ml-2">{attempt.integrationName} ({attempt.platform})</span>
                                              <Badge variant={getIntegrationStatusBadgeVariant(attempt.status)} className={`ml-auto text-xs ${attempt.status === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}>
                                                {attempt.status.replace(/_/g, ' ').toUpperCase()}
                                              </Badge>
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="text-xs space-y-2">
                                            <p><strong>Target Format:</strong> {attempt.targetFormat.toUpperCase()}</p>
                                            <p><strong>Webhook URL:</strong> <span className="truncate">{attempt.webhookUrl}</span></p>
                                            {attempt.errorDetails && <p><strong>Error:</strong> {attempt.errorDetails}</p>}
                                            {attempt.outgoingPayload && (
                                               <div>
                                                <strong>Outgoing Payload:</strong>
                                                <SyntaxHighlighter 
                                                  language={attempt.targetFormat === 'xml' ? 'xml' : 'json'} 
                                                  style={atomDark} 
                                                  customStyle={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.75rem' }}
                                                  className="rounded-md"
                                                >
                                                  {attempt.outgoingPayload}
                                                </SyntaxHighlighter>
                                               </div>
                                            )}
                                            {attempt.responseStatus !== undefined && <p><strong>Response Status:</strong> {attempt.responseStatus}</p>}
                                            {attempt.responseBody && (
                                               <div>
                                                <strong>Response Body:</strong>
                                                 <SyntaxHighlighter 
                                                  language="text" 
                                                  style={atomDark} 
                                                  customStyle={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.75rem' }}
                                                  className="rounded-md"
                                                >
                                                  {attempt.responseBody}
                                                </SyntaxHighlighter>
                                               </div>
                                            )}
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </CardContent>
                                  </Card>
                                </div>
                              </ScrollArea>
                              <DialogFooter className="sm:justify-start">
                                <DialogClose asChild>
                                  <Button type="button" variant="secondary">Close</Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          )}
                        </Dialog>
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
