"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, 
  Pause, Play, MoreVertical, Eye, Trash2, RotateCcw 
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { QueuedNotification } from "@/lib/types";

export default function NotificationQueuePage() {
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [queueEnabled, setQueueEnabled] = useState<boolean>(true);
  const [toggleLoading, setToggleLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0
  });
  const [notifications, setNotifications] = useState<QueuedNotification[]>([]);
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/management/queue');
      if (!res.ok) throw new Error('Failed to fetch queue stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching queue stats:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch queue statistics."
      });
    }
  };

  const fetchNotifications = async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/management/queue?status=${status}`);
      if (!res.ok) throw new Error(`Failed to fetch ${status} notifications`);
      const data = await res.json();
      setNotifications(data);
    } catch (error) {
      console.error(`Error fetching ${status} notifications:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to fetch ${status} notifications.`
      });
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/management/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process' })
      });
      
      if (!res.ok) throw new Error('Failed to process queue');
      
      const data = await res.json();
      toast({
        title: "Queue Processing",
        description: `Processed ${data.processed} notifications: ${data.succeeded} succeeded, ${data.failed} failed.`
      });
      
      // Refresh data
      fetchStats();
      fetchNotifications(activeTab);
    } catch (error) {
      console.error('Error processing queue:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process notification queue."
      });
    } finally {
      setProcessing(false);
    }
  };

  // State for notification details dialog
  const [selectedNotification, setSelectedNotification] = useState<QueuedNotification | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState<boolean>(false);
  const [showFullPayload, setShowFullPayload] = useState<boolean>(false);
  const [showFullResponse, setShowFullResponse] = useState<boolean>(false);

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch('/api/management/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', id })
      });
      
      if (!res.ok) throw new Error('Failed to retry notification');
      
      toast({
        title: "Notification Queued",
        description: "The notification has been queued for retry."
      });
      
      // Refresh data
      fetchStats();
      fetchNotifications(activeTab);
    } catch (error) {
      console.error('Error retrying notification:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to retry notification."
      });
    }
  };

  const handlePauseNotification = async (id: string) => {
    try {
      const res = await fetch('/api/management/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', id })
      });
      
      if (!res.ok) throw new Error('Failed to pause notification');
      
      toast({
        title: "Notification Paused",
        description: "The notification has been paused."
      });
      
      // Refresh data
      fetchStats();
      fetchNotifications(activeTab);
    } catch (error) {
      console.error('Error pausing notification:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to pause notification."
      });
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch('/api/management/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      });
      
      if (!res.ok) throw new Error('Failed to delete notification');
      
      toast({
        title: "Notification Deleted",
        description: "The notification has been deleted."
      });
      
      // Refresh data
      fetchStats();
      fetchNotifications(activeTab);
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete notification."
      });
    }
  };

  const handleViewDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/management/queue?id=${id}`);
      
      if (!res.ok) throw new Error('Failed to fetch notification details');
      
      const notification = await res.json();
      setSelectedNotification(notification);
      setShowDetailsDialog(true);
    } catch (error) {
      console.error('Error fetching notification details:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch notification details."
      });
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLoading(true);
    fetchNotifications(value);
    // Also refresh stats when changing tabs
    fetchStats();
  };

  const fetchQueueStatus = async () => {
    try {
      const res = await fetch('/api/management/queue/status');
      if (!res.ok) throw new Error('Failed to fetch queue status');
      const data = await res.json();
      setQueueEnabled(data.enabled);
    } catch (error) {
      console.error('Error fetching queue status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch queue processing status."
      });
    }
  };

  const toggleQueueProcessing = async () => {
    setToggleLoading(true);
    try {
      const res = await fetch('/api/management/queue/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !queueEnabled })
      });
      
      if (!res.ok) throw new Error('Failed to update queue status');
      
      const data = await res.json();
      setQueueEnabled(data.enabled);
      
      toast({
        title: data.enabled ? "Queue Processing Enabled" : "Queue Processing Paused",
        description: data.message
      });
    } catch (error) {
      console.error('Error toggling queue status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update queue processing status."
      });
    } finally {
      setToggleLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchStats();
    fetchNotifications(activeTab);
    fetchQueueStatus();
    
    // Set up polling for stats and notifications
    const interval = setInterval(() => {
      console.log("Auto-refreshing notification queue data");
      fetchStats();
      if (!loading) fetchNotifications(activeTab);
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pending</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Processing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Completed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageShell 
      title="Notification Queue" 
      description="Manage outgoing notification delivery queue"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Waiting to be processed</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processing}</div>
              <p className="text-xs text-muted-foreground">Currently being sent</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Successfully delivered</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">Failed to deliver</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button onClick={() => { fetchStats(); fetchNotifications(activeTab); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          
          <div className="space-x-2">
            <Button 
              variant={queueEnabled ? "outline" : "default"} 
              onClick={toggleQueueProcessing} 
              disabled={toggleLoading}
              className={queueEnabled ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200" : "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"}
            >
              {toggleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {queueEnabled ? "Pausing..." : "Enabling..."}
                </>
              ) : (
                <>
                  {queueEnabled ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause Processing
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Resume Processing
                    </>
                  )}
                </>
              )}
            </Button>
            
            <Button onClick={handleProcessQueue} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Process Queue
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Notifications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Queue</CardTitle>
            <CardDescription>
              View and manage notifications in the queue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending" onValueChange={handleTabChange}>
              <TabsList className="mb-4">
                <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                <TabsTrigger value="processing">Processing ({stats.processing})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab}>
                {loading ? (
                  <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    No {activeTab} notifications found
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="py-3 px-4 text-left font-medium">Status</th>
                            <th className="py-3 px-4 text-left font-medium">Integration</th>
                            <th className="py-3 px-4 text-left font-medium">API Endpoint</th>
                            <th className="py-3 px-4 text-left font-medium">Created</th>
                            <th className="py-3 px-4 text-left font-medium">Last Attempt</th>
                            <th className="py-3 px-4 text-left font-medium">Next Retry</th>
                            <th className="py-3 px-4 text-left font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {notifications.map((notification) => (
                            <tr key={notification.id} className="border-b">
                              <td className="py-3 px-4 align-middle">
                                <div className="flex items-center">
                                  {getStatusIcon(notification.status)}
                                  <span className="ml-2">{getStatusBadge(notification.status)}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 align-middle">
                                <div className="font-medium truncate max-w-[150px]" title={notification.integrationName}>
                                  {notification.integrationName}
                                </div>
                                <div className="text-xs text-muted-foreground">{notification.platform}</div>
                              </td>
                              <td className="py-3 px-4 align-middle">
                                <div className="font-medium truncate max-w-[150px]" title={notification.apiEndpointName}>
                                  {notification.apiEndpointName}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                  {/* Hide API Endpoint ID for privacy */}
                                  <span className="text-gray-400">UUID hidden for security</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 align-middle">
                                {formatDate(notification.createdAt)}
                              </td>
                              <td className="py-3 px-4 align-middle">
                                {formatDate(notification.lastAttemptAt)}
                                {notification.responseStatus && (
                                  <div className="text-xs text-muted-foreground">
                                    Status: {notification.responseStatus}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 align-middle">
                                {formatDate(notification.nextRetryAt)}
                                {notification.status === 'failed' && (
                                  <div className="text-xs text-muted-foreground">
                                    Retries: {notification.retryCount}/{notification.maxRetries}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 align-middle">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                      <span className="sr-only">Actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewDetails(notification.id)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    
                                    {notification.status !== 'completed' && (
                                      <DropdownMenuItem onClick={() => handlePauseNotification(notification.id)}>
                                        <Pause className="mr-2 h-4 w-4" />
                                        Pause
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {notification.status === 'failed' && notification.retryCount < notification.maxRetries && (
                                      <DropdownMenuItem onClick={() => handleRetry(notification.id)}>
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Retry
                                      </DropdownMenuItem>
                                    )}
                                    
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteNotification(notification.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Notification Details Dialog */}
      <Dialog 
        open={showDetailsDialog} 
        onOpenChange={(open) => {
          setShowDetailsDialog(open);
          if (!open) {
            // Reset state when dialog closes
            setShowFullPayload(false);
            setShowFullResponse(false);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>
              View the complete details of this notification
            </DialogDescription>
          </DialogHeader>
          
          {selectedNotification && (
            <div className="space-y-6">
              <div className="bg-muted/30 border rounded-lg p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">Status</h3>
                    <div className="flex items-center">
                      {getStatusIcon(selectedNotification.status)}
                      <span className="ml-2">{getStatusBadge(selectedNotification.status)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">Created</h3>
                    <p className="font-medium">{formatDate(selectedNotification.createdAt)}</p>
                  </div>
                  
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">Last Attempt</h3>
                    <p className="font-medium">{formatDate(selectedNotification.lastAttemptAt)}</p>
                  </div>
                  
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">Next Retry</h3>
                    <p className="font-medium">{formatDate(selectedNotification.nextRetryAt)}</p>
                  </div>
                  
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">Integration</h3>
                    <p className="font-semibold">{selectedNotification.integrationName}</p>
                    <p className="text-sm text-muted-foreground">{selectedNotification.platform}</p>
                  </div>
                  
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">API Endpoint</h3>
                    <p className="font-semibold">{selectedNotification.apiEndpointName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="bg-yellow-50 text-yellow-700 px-1 py-0.5 rounded text-xs">ID hidden for security</span>
                    </p>
                  </div>
                  
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">Response Status</h3>
                    {selectedNotification.responseStatus ? (
                      <span className={`font-mono font-medium px-2 py-1 rounded ${
                        selectedNotification.responseStatus >= 200 && selectedNotification.responseStatus < 300 
                          ? 'bg-green-50 text-green-700'
                          : selectedNotification.responseStatus >= 400
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}>
                        {selectedNotification.responseStatus}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </div>
                  
                  <div className="bg-background p-3 rounded-lg border shadow-sm">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">Retry Count</h3>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedNotification.retryCount} / {selectedNotification.maxRetries}</span>
                      {selectedNotification.status === 'failed' && selectedNotification.retryCount >= selectedNotification.maxRetries && (
                        <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-xs">Max retries reached</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Webhook URL</h3>
                </div>
                <div className="bg-muted p-4 rounded-md text-sm font-mono overflow-x-auto border border-border shadow-sm">
                  {/* Obfuscate the webhook URL for enhanced security */}
                  {(() => {
                    try {
                      const url = new URL(selectedNotification.webhookUrl);
                      // Only show protocol and hostname, mask everything else
                      return `${url.protocol}//${url.hostname}/*****`;
                    } catch {
                      // If not a valid URL, just indicate it's hidden
                      return "Webhook URL hidden for security";
                    }
                  })()}
                </div>
                <div className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 rounded mt-2 px-3 py-2 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Full webhook URL is hidden for security reasons
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Payload</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-3 flex items-center gap-1"
                        title="Copy to clipboard"
                        onClick={() => {
                          // Ensure payload exists before trying to parse or copy it
                          if (selectedNotification.payload) {
                            try {
                              const parsed = JSON.parse(selectedNotification.payload);
                              navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
                              toast({
                                title: "Copied",
                                description: "Payload copied to clipboard",
                                duration: 2000
                              });
                            } catch {
                              navigator.clipboard.writeText(selectedNotification.payload);
                              toast({
                                title: "Copied",
                                description: "Payload copied to clipboard",
                                duration: 2000
                              });
                            }
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 12h8m-7 8h6a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Copy
                      </Button>
                      <Button 
                        variant={showFullPayload ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setShowFullPayload(!showFullPayload)}
                        className="h-7 text-xs px-3"
                      >
                        {showFullPayload ? "Show Less" : "Show Full Payload"}
                      </Button>
                    </div>
                  </div>
                  <div 
                    className={`bg-muted p-4 rounded-md text-sm font-mono overflow-x-auto whitespace-pre border border-border ${!showFullPayload ? 'max-h-72' : 'max-h-[450px]'} transition-all duration-300 shadow-sm`}
                    style={{overflowY: 'auto'}}
                  >
                    {(() => {
                      try {
                        const parsed = JSON.parse(selectedNotification.payload);
                        return JSON.stringify(parsed, null, 2);
                      } catch {
                        return selectedNotification.payload;
                      }
                    })()}
                  </div>
                  {!showFullPayload && (
                    <div className="text-center text-xs text-muted-foreground mt-2 bg-muted/50 py-1 rounded border-t">
                      Showing partial payload. Click "Show Full Payload" to expand.
                    </div>
                  )}
                </div>
                
                {selectedNotification.responseBody && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">Response Body</h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3 flex items-center gap-1"
                          title="Copy to clipboard"
                          onClick={() => {
                            // Ensure responseBody exists before trying to copy it
                            if (selectedNotification.responseBody) {
                              try {
                                const parsed = JSON.parse(selectedNotification.responseBody);
                                navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
                                toast({
                                  title: "Copied",
                                  description: "Response copied to clipboard",
                                  duration: 2000
                                });
                              } catch {
                                navigator.clipboard.writeText(selectedNotification.responseBody);
                                toast({
                                  title: "Copied",
                                  description: "Response copied to clipboard",
                                  duration: 2000
                                });
                              }
                            }
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 12h8m-7 8h6a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Copy
                        </Button>
                        <Button 
                          variant={showFullResponse ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => setShowFullResponse(!showFullResponse)}
                          className="h-7 text-xs px-3"
                        >
                          {showFullResponse ? "Show Less" : "Show Full Response"}
                        </Button>
                      </div>
                    </div>
                    <div 
                      className={`bg-muted p-4 rounded-md text-sm font-mono overflow-x-auto whitespace-pre border border-border ${!showFullResponse ? 'max-h-72' : 'max-h-[450px]'} transition-all duration-300 shadow-sm`}
                      style={{overflowY: 'auto'}}
                    >
                      {(() => {
                        try {
                          const parsed = JSON.parse(selectedNotification.responseBody);
                          return JSON.stringify(parsed, null, 2);
                        } catch {
                          return selectedNotification.responseBody;
                        }
                      })()}
                    </div>
                    {!showFullResponse && (
                      <div className="text-center text-xs text-muted-foreground mt-2 bg-muted/50 py-1 rounded border-t">
                        Showing partial response. Click "Show Full Response" to expand.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {selectedNotification.errorDetails && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Error Details</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 flex items-center gap-1"
                      title="Copy error details"
                      onClick={() => {
                        // Ensure errorDetails exists before trying to copy it
                        if (selectedNotification.errorDetails) {
                          navigator.clipboard.writeText(selectedNotification.errorDetails);
                          toast({
                            title: "Copied",
                            description: "Error details copied to clipboard",
                            duration: 2000
                          });
                        }
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 12h8m-7 8h6a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Copy
                    </Button>
                  </div>
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm overflow-x-auto font-mono whitespace-pre-wrap shadow-sm">
                    {selectedNotification.errorDetails}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>Close</Button>
                
                {selectedNotification.status === 'failed' && selectedNotification.retryCount < selectedNotification.maxRetries && (
                  <Button onClick={() => {
                    handleRetry(selectedNotification.id);
                    setShowDetailsDialog(false);
                  }}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
