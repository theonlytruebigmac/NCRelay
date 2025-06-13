"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { BackButton } from "@/components/layout/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { format, parseISO } from "date-fns";
import { CheckCircle, XCircle, HelpCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLogByIdAction, deleteLogEntryAction } from "../actions";
import { LogEntry, LoggedIntegrationAttempt } from "@/lib/types";
import { getPlatformFormat, getPlatformFormatDescription } from "@/lib/platform-helpers";
import { WebhookUrlField } from "@/components/ui/webhook-url-field";

// Status icon components
const IntegrationStatusIcon = ({ status }: { status: LoggedIntegrationAttempt['status'] }) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed_transformation':
    case 'failed_relay':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'skipped_disabled':
    case 'skipped_no_association':
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function LogDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const logId = params.id as string;
  
  const [log, setLog] = useState<LogEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchLog() {
      try {
        setIsLoading(true);
        const logData = await getLogByIdAction(logId);
        setLog(logData);
      } catch (error) {
        console.error("Failed to fetch log details:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load log details. Please try again.",
        });
        router.push('/dashboard/logs');
      } finally {
        setIsLoading(false);
      }
    }

    fetchLog();
  }, [logId, toast, router]);

  const handleDeleteLog = async () => {
    setIsDeleting(true);
    try {
      await deleteLogEntryAction(logId);
      toast({
        title: "Log deleted",
        description: "The log entry has been successfully deleted.",
      });
      router.push('/dashboard/logs');
    } catch (error) {
      console.error("Failed to delete log:", error);
      toast({
        title: "Error",
        description: "Failed to delete the log entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
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
      <PageShell title="Log Details" description="Loading log details...">
        <div className="flex items-center space-x-2 mb-6">
          <BackButton href="/dashboard/logs" label="Back to Logs" />
        </div>
        <div className="bg-card animate-pulse h-80 rounded-lg"></div>
      </PageShell>
    );
  }

  if (!log) {
    return (
      <PageShell title="Log Not Found" description="The requested log could not be found.">
        <div className="flex items-center space-x-2 mb-6">
          <BackButton href="/dashboard/logs" label="Back to Logs" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center p-6">
              <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold">Log Not Found</h2>
              <p className="text-muted-foreground mt-2">The log entry you are looking for could not be found or may have been deleted.</p>
              <Button className="mt-4" onClick={() => router.push('/dashboard/logs')}>
                Return to Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell 
      title={`Log Details: ${log.apiEndpointName || log.apiEndpointPath}`}
      description={`Log from ${format(parseISO(log.timestamp), "MMM d, yyyy HH:mm:ss")}`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <BackButton href="/dashboard/logs" label="Back to Logs" />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete Log"}
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
                  onClick={handleDeleteLog}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="log-page-timestamp mb-4">
          <span className="text-muted-foreground">
            {format(parseISO(log.timestamp), "MMMM d, yyyy 'at' h:mm:ss a zzz")}
          </span>
        </div>
        
        {/* API Endpoint Information */}
        <Card className="log-page-card mb-6">
          <CardHeader>
            <CardTitle>API Endpoint Information</CardTitle>
          </CardHeader>
          <CardContent className="log-page-card-content">
            <div className="log-page-field">
              <span className="log-page-label">Name:</span> 
              <span className="log-page-value font-semibold">{log.apiEndpointName}</span>
            </div>
            <div className="log-page-field">
              <span className="log-page-label">Path:</span> 
              <span className="log-page-value font-mono">
                {log.apiEndpointPath.startsWith("/api/custom/") 
                  ? "/api/custom/" 
                  : log.apiEndpointPath}
                <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs ml-2">
                  UUID portion hidden for security
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="log-page-sections space-y-6">
        {/* Incoming Request Card */}
        <Card className="log-page-card">
          <CardHeader>
            <CardTitle>Incoming Request</CardTitle>
          </CardHeader>
          <CardContent className="log-page-card-content">
            <div className="log-page-field">
              <span className="log-page-label">IP:</span> 
              <span className="log-page-value">{log.incomingRequest.ip || "N/A"}</span>
            </div>
            <div className="log-page-field">
              <span className="log-page-label">Method:</span> 
              <span className="log-page-value">{log.incomingRequest.method}</span>
            </div>
            <div className="log-page-field">
              <span className="log-page-label">Headers:</span>
              <div className="log-page-syntax-container" data-language="JSON">
                <SyntaxHighlighter 
                  language="json" 
                  style={atomDark} 
                  className="log-page-syntax"
                  wrapLines={false}
                >
                  {JSON.stringify(log.incomingRequest.headers, null, 2)}
                </SyntaxHighlighter>
              </div>
            </div>
            <div className="log-page-field">
              <span className="log-page-label">Raw Body (XML):</span>
              <div className="log-page-syntax-container" data-language="XML">
                <SyntaxHighlighter 
                  language="xml" 
                  style={atomDark} 
                  className="log-page-syntax"
                  wrapLines={false}
                >
                  {log.incomingRequest.bodyRaw}
                </SyntaxHighlighter>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processing Summary Card */}
        <Card className="log-page-card">
          <CardHeader>
            <CardTitle>Processing Summary</CardTitle>
          </CardHeader>
          <CardContent className="log-page-card-content">
             <div className="flex flex-wrap items-center gap-2">
               <span className="log-page-label">Overall Status:</span> 
               <Badge 
                   variant={getStatusBadgeVariant(log.processingSummary.overallStatus)}
                   className={`log-page-status-badge ${log.processingSummary.overallStatus}`}
               >
                   {log.processingSummary.overallStatus.replace(/_/g, ' ').toUpperCase()}
               </Badge>
             </div>
            <div className="log-page-field">
              <span className="log-page-label">Message:</span> 
              <div className="log-page-code-container">
                <span className="log-page-code">{log.processingSummary.message}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration Attempts Card */}
        <Card className="log-page-card">
          <CardHeader>
            <CardTitle>Integration Attempts ({log.integrations.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {log.integrations.length === 0 ? 
              <div className="text-sm text-muted-foreground">No integrations were attempted.</div> : 
              log.integrations.map((attempt, idx) => (
                <Card key={idx} className="log-page-integration-card">
                  <CardHeader className="log-page-integration-header">
                    <div className="log-page-integration-title">
                      <div className="log-page-integration-name">
                        <IntegrationStatusIcon status={attempt.status}/>
                        <span className="log-page-value font-medium">{attempt.integrationName} ({attempt.platform})</span>
                      </div>
                      <Badge variant={getIntegrationStatusBadgeVariant(attempt.status)} className={`log-page-status-badge ${attempt.status}`}>
                        {attempt.status.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="log-page-integration-content">
                    <div className="log-page-field">
                      <span className="log-page-label">Format:</span> 
                      <span className="log-page-format-badge">{getPlatformFormatDescription(attempt.platform)}</span>
                    </div>
                    <div className="log-page-field">
                      <span className="log-page-label">Webhook URL:</span> 
                      <div className="mt-2">
                        <WebhookUrlField
                          value={attempt.webhookUrl}
                          disabled={true}
                          showCopyButton={true}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                    {attempt.errorDetails && (
                      <div className="log-page-field">
                        <span className="log-page-label">Error:</span> 
                        <div className="log-page-error-container">
                          <span className="log-page-error-text">{attempt.errorDetails}</span>
                        </div>
                      </div>
                    )}
                    {attempt.outgoingPayload && (
                       <div className="log-page-field">
                        <span className="log-page-label">Outgoing Payload:</span>
                        <div className="log-page-syntax-container" data-language={getPlatformFormat(attempt.platform) === 'json' ? 'JSON' : 'XML'}>
                          <SyntaxHighlighter 
                            language={getPlatformFormat(attempt.platform) === 'json' ? 'json' : 'xml'} 
                            style={atomDark} 
                            className="log-page-syntax"
                            wrapLines={true}
                            wrapLongLines={true}
                            showLineNumbers={true}
                            customStyle={{
                              maxWidth: '100%',
                              overflowX: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}
                          >
                            {(() => {
                              if (getPlatformFormat(attempt.platform) === 'json') {
                                try {
                                  return JSON.stringify(JSON.parse(attempt.outgoingPayload), null, 2);
                                } catch (e) {
                                  return attempt.outgoingPayload;
                                }
                              }
                              return attempt.outgoingPayload;
                            })()}
                          </SyntaxHighlighter>
                        </div>
                       </div>
                    )}
                    {attempt.responseStatus !== undefined && (
                      <div className="log-page-field">
                        <span className="log-page-label">Response Status:</span> 
                        <span className="log-page-format-badge">{attempt.responseStatus}</span>
                      </div>
                    )}
                    {attempt.responseBody && (
                       <div className="log-page-field">
                        <span className="log-page-label">Response Body:</span>
                        <div className="log-page-syntax-container" data-language="RESPONSE">
                          <SyntaxHighlighter 
                            language="text" 
                            style={atomDark} 
                            className="log-page-syntax"
                            wrapLines={false}
                            showLineNumbers={true}
                          >
                            {attempt.responseBody}
                          </SyntaxHighlighter>
                        </div>
                       </div>
                    )}
                  </CardContent>
                </Card>                ))
            }
          </CardContent>
        </Card>
        </div>
      </div>
    </PageShell>
  );
}
