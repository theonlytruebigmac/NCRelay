"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/context/AuthContext";
import { Settings, Zap, History, Activity, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Loader2, Clock, ArrowRight, Filter as FilterIcon, Waypoints, Shield, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboardStatsAction } from './actions'; // Import the new Server Action
import type { DashboardStats } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Separator } from "@/components/ui/separator";


interface MonitoringData {
  queueStats: Array<{ status: string; count: number; avgRetries: number }>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    method: string;
    apiEndpointName: string;
    status: string;
    apiEndpointId?: string;
  }>;
  integrationHealth: Array<{
    id: string;
    name: string;
    platform: string;
    enabled: boolean;
    failedCount: number;
    successCount: number;
    totalCount: number;
  }>;
  overview: {
    activeEndpoints: number;
    activeIntegrations: number;
    successRate: number;
    queueDepth: number;
  };
  systemMetrics: {
    uptime: number;
  };
  timestamp: string;
}

interface ChartDataPoint {
  timestamp: number;
  queueSize: number;
  failedCount: number;
  successRate: number;
  requestCount: number;
  successCount: number;
}

interface PipelineStageStats {
  total: number;
  success: number;
  failed: number;
  successRate: number;
}

function ActivityTooltipContent({ activity, details }: { activity: any; details?: any }) {
  if (!details) {
    return (
      <div className="space-y-1">
        <p className="font-semibold text-sm">{activity.status}</p>
        <p className="text-xs text-muted-foreground">Loading details...</p>
      </div>
    );
  }

  const integrationStats = details.integrations?.reduce(
    (acc: any, int: any) => {
      if (int.success) acc.success++;
      else acc.failed++;
      return acc;
    },
    { success: 0, failed: 0 }
  ) || { success: 0, failed: 0 };

  const totalIntegrations = integrationStats.success + integrationStats.failed;

  return (
    <div className="space-y-2">
      <div>
        <p className="font-semibold text-sm">
          {activity.status === 'success' && 'Successfully Delivered'}
          {activity.status === 'partial_failure' && 'Partially Delivered'}
          {activity.status === 'failed' && 'Delivery Failed'}
          {activity.status === 'total_failure' && 'Total Failure'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(activity.timestamp).toLocaleString()}
        </p>
      </div>
      
      {totalIntegrations > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs font-medium mb-1">Integrations</p>
          <div className="flex items-center gap-3 text-xs">
            {integrationStats.success > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>{integrationStats.success} succeeded</span>
              </div>
            )}
            {integrationStats.failed > 0 && (
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span>{integrationStats.failed} failed</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {details.processingSummary?.message && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {details.processingSummary.message}
          </p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [monitorData, setMonitorData] = useState<MonitoringData | null>(null);
  const [history, setHistory] = useState<ChartDataPoint[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('dashboardRefreshInterval') || '0');
    }
    return 0;
  });
  const [activityFilter, setActivityFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activityDetails, setActivityDetails] = useState<Record<string, any>>({});
  const { can } = usePermissions();
  const { toast } = useToast();
  
  const canViewIntegrations = can('integrations', 'read');
  const canViewLogs = can('logs', 'read');
  const canViewEndpoints = can('endpoints', 'read');

  const fetchActivityDetails = async (activityId: string) => {
    if (activityDetails[activityId]) return activityDetails[activityId];
    
    try {
      const res = await fetch(`/api/logs/${activityId}`);
      if (res.ok) {
        const data = await res.json();
        setActivityDetails(prev => ({ ...prev, [activityId]: data }));
        return data;
      }
    } catch (error) {
      console.error('Failed to fetch activity details:', error);
    }
    return null;
  };

  const fetchMonitorData = async () => {
    if (!canViewLogs) return;
    
    try {
      const res = await fetch('/api/monitoring/live');
      if (!res.ok) throw new Error('Failed to fetch monitoring data');
      
      const newData: MonitoringData = await res.json();
      setMonitorData(newData);

      // Update history for charts (keep last 20 data points)
      setHistory(prev => {
        const queueSize = newData.queueStats.reduce((sum, s) => sum + s.count, 0);
        const failedCount = newData.queueStats.find(s => s.status === 'failed')?.count || 0;
        const recentRequests = newData.recentActivity.slice(0, 50);
        const successCount = recentRequests.filter((a: any) => a.status === 'success').length;
        
        return [...prev, {
          timestamp: new Date(newData.timestamp).getTime(),
          queueSize,
          failedCount,
          successRate: newData.overview.successRate,
          requestCount: recentRequests.length,
          successCount
        }].slice(-20);
      });
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    }
  };

  useEffect(() => {
    async function fetchStats() {
      setIsLoadingStats(true);
      try {
        const fetchedStats = await getDashboardStatsAction();
        setStats(fetchedStats);
      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
        setStats({ 
          activeIntegrationsCount: 0, 
          relayedNotificationsCount: 0,
          apiEndpointsCount: 0,
          apiEndpointsRequestsCount: 0,
          outboundSuccessCount: 0,
          outboundFailureCount: 0,
          outboundSuccessRate: 0,
          totalOutboundAttempts: 0,
        });
      } finally {
        setIsLoadingStats(false);
      }
    }
    fetchStats();
    
    // Initial fetch of monitoring data
    if (canViewLogs) {
      fetchMonitorData();
    }
  }, [canViewLogs]);

  useEffect(() => {
    // Auto-refresh monitoring data
    let interval: NodeJS.Timeout | null = null;
    if (refreshInterval > 0 && canViewLogs) {
      interval = setInterval(async () => {
        setIsRefreshing(true);
        await Promise.all([fetchMonitorData(), fetchStats()]);
        setTimeout(() => setIsRefreshing(false), 500);
      }, refreshInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [refreshInterval, canViewLogs]);

  async function fetchStats() {
    try {
      const fetchedStats = await getDashboardStatsAction();
      setStats(fetchedStats);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    }
  }

  const handleRefreshIntervalChange = (value: number) => {
    setRefreshInterval(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardRefreshInterval', value.toString());
    }
  };

  // Calculate pipeline stage statistics
  const calculatePipelineStats = (): Record<string, PipelineStageStats> => {
    if (!monitorData || !stats) return {};

    const recentActivities = monitorData.recentActivity.slice(0, 50);
    
    return {
      endpoints: {
        total: stats.apiEndpointsCount,
        success: recentActivities.filter(a => a.status === 'success').length,
        failed: recentActivities.filter(a => a.status === 'failed' || a.status === 'partial_failure').length,
        successRate: stats.outboundSuccessRate
      },
      security: {
        total: recentActivities.length,
        success: recentActivities.filter(a => a.status === 'success').length,
        failed: recentActivities.filter(a => a.status === 'failed').length,
        successRate: stats.outboundSuccessRate
      },
      filters: {
        total: recentActivities.length,
        success: recentActivities.filter(a => a.status === 'success').length,
        failed: recentActivities.filter(a => a.status === 'failed').length,
        successRate: stats.outboundSuccessRate
      },
      integrations: {
        total: stats.activeIntegrationsCount,
        success: stats.outboundSuccessCount,
        failed: stats.outboundFailureCount,
        successRate: stats.outboundSuccessRate
      }
    };
  };

  const pipelineStats = calculatePipelineStats();

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now.getTime() - activityTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins < 1 ? 'Just now' : 
           diffMins === 1 ? '1 min ago' : 
           diffMins < 60 ? `${diffMins} mins ago` : 
           `${Math.floor(diffMins / 60)}h ago`;
  };

  const systemHealth = monitorData && monitorData.overview.queueDepth > 1000 ? 'Warning' : 'Healthy';

  return (
    <PageShell
      title={`Welcome, ${user?.name || 'User'}!`}
      description="Real-time system status and performance metrics"
      actions={
        canViewLogs ? (
          <div className="flex items-center gap-2">
            {isRefreshing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                Updating...
              </div>
            )}
            <select
              value={refreshInterval}
              onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="0">Manual</option>
              <option value="5000">5 seconds</option>
              <option value="10000">10 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsRefreshing(true);
                await Promise.all([fetchMonitorData(), fetchStats()]);
                setTimeout(() => setIsRefreshing(false), 500);
              }}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ) : undefined
      }
    >
      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {canViewLogs && monitorData && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
              {systemHealth === 'Healthy' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Uptime {Math.floor(monitorData.systemMetrics.uptime / 3600)}h {Math.floor((monitorData.systemMetrics.uptime % 3600) / 60)}m
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoadingStats || !stats ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats.outboundSuccessRate}%</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {!isLoadingStats && stats && stats.totalOutboundAttempts > 0 
                ? `${stats.outboundSuccessCount} of ${stats.totalOutboundAttempts}`
                : "No attempts yet"
              }
            </p>
          </CardContent>
        </Card>

        {canViewLogs && monitorData && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Queue Depth</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monitorData.overview.queueDepth}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pending delivery
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Relays</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoadingStats || !stats ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{stats.outboundFailureCount}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Last 50 requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notification Flow Pipeline */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waypoints className="h-5 w-5" />
            Notification Flow Pipeline
          </CardTitle>
          <CardDescription>How webhooks are processed through your system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-8 px-4">
            {/* Stage 1: Endpoint */}
            <button
              onClick={() => setSelectedPipelineStage('endpoints')}
              className="flex flex-col items-center flex-1 hover:bg-muted/50 p-3 rounded-lg transition-colors cursor-pointer"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Waypoints className="h-8 w-8 text-primary" />
                </div>
                {pipelineStats.endpoints && (
                  <>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {pipelineStats.endpoints.total}
                    </div>
                    {pipelineStats.endpoints.failed > 0 && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center text-xs font-bold text-destructive-foreground">
                        {pipelineStats.endpoints.failed}
                      </div>
                    )}
                  </>
                )}
              </div>
              <h3 className="font-semibold text-sm">Endpoints</h3>
              <p className="text-xs text-muted-foreground text-center mt-1">Receive webhooks</p>
              <span className="text-xs text-primary hover:underline mt-2">
                Click to view details
              </span>
            </button>

            <div className="flex-1 flex items-center justify-center px-4">
              <div className="h-0.5 w-full bg-gradient-to-r from-primary/50 to-purple-500/50 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Stage 2: Security */}
            <button
              onClick={() => setSelectedPipelineStage('security')}
              className="flex flex-col items-center flex-1 hover:bg-muted/50 p-3 rounded-lg transition-colors cursor-pointer"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                  <Shield className="h-8 w-8 text-purple-500" />
                </div>
                {pipelineStats.security && (
                  <>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">
                      {pipelineStats.security.success}
                    </div>
                    {pipelineStats.security.failed > 0 && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center text-xs font-bold text-destructive-foreground">
                        {pipelineStats.security.failed}
                      </div>
                    )}
                  </>
                )}
              </div>
              <h3 className="font-semibold text-sm">Security</h3>
              <p className="text-xs text-muted-foreground text-center mt-1">Rate limit & IP check</p>
              <span className="text-xs text-primary hover:underline mt-2">
                Click to view details
              </span>
            </button>

            <div className="flex-1 flex items-center justify-center px-4">
              <div className="h-0.5 w-full bg-gradient-to-r from-purple-500/50 to-blue-500/50 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Stage 3: Filters */}
            <button
              onClick={() => setSelectedPipelineStage('filters')}
              className="flex flex-col items-center flex-1 hover:bg-muted/50 p-3 rounded-lg transition-colors cursor-pointer"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                  <FilterIcon className="h-8 w-8 text-blue-500" />
                </div>
                {pipelineStats.filters && (
                  <>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                      {pipelineStats.filters.success}
                    </div>
                    {pipelineStats.filters.failed > 0 && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center text-xs font-bold text-destructive-foreground">
                        {pipelineStats.filters.failed}
                      </div>
                    )}
                  </>
                )}
              </div>
              <h3 className="font-semibold text-sm">Field Filters</h3>
              <p className="text-xs text-muted-foreground text-center mt-1">Transform data</p>
              <span className="text-xs text-primary hover:underline mt-2">
                Click to view details
              </span>
            </button>

            <div className="flex-1 flex items-center justify-center px-4">
              <div className="h-0.5 w-full bg-gradient-to-r from-blue-500/50 to-green-500/50 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Stage 4: Integrations */}
            <button
              onClick={() => setSelectedPipelineStage('integrations')}
              className="flex flex-col items-center flex-1 hover:bg-muted/50 p-3 rounded-lg transition-colors cursor-pointer"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                  <Zap className="h-8 w-8 text-green-500" />
                </div>
                {pipelineStats.integrations && (
                  <>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold text-white">
                      {pipelineStats.integrations.total}
                    </div>
                    {pipelineStats.integrations.failed > 0 && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center text-xs font-bold text-destructive-foreground">
                        {pipelineStats.integrations.failed}
                      </div>
                    )}
                  </>
                )}
              </div>
              <h3 className="font-semibold text-sm">Integrations</h3>
              <p className="text-xs text-muted-foreground text-center mt-1">Deliver to platforms</p>
              <span className="text-xs text-primary hover:underline mt-2">
                Click to view details
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stage Detail Modal */}
      {selectedPipelineStage && pipelineStats[selectedPipelineStage] && (
        <Card className="border-2 border-primary mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="capitalize">{selectedPipelineStage} Details</CardTitle>
                <CardDescription>
                  Success and failure metrics for this stage
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPipelineStage(null)}
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{pipelineStats[selectedPipelineStage].total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{pipelineStats[selectedPipelineStage].success}</div>
                <div className="text-xs text-muted-foreground">Success</div>
              </div>
              <div className="text-center p-4 bg-destructive/10 rounded-lg">
                <div className="text-2xl font-bold text-destructive">{pipelineStats[selectedPipelineStage].failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <div className="text-2xl font-bold text-primary">{pipelineStats[selectedPipelineStage].successRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Recent Activity</span>
                <Link 
                  href={
                    selectedPipelineStage === 'endpoints' ? '/dashboard/settings/api' :
                    selectedPipelineStage === 'security' ? '/dashboard/settings/security-policies' :
                    selectedPipelineStage === 'filters' ? '/dashboard/filters' :
                    '/dashboard/integrations'
                  }
                  className="text-primary hover:underline"
                >
                  Configure →
                </Link>
              </div>
              
              {monitorData?.recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {activity.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{activity.apiEndpointName || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{activity.method}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTimestamp(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {canViewLogs && monitorData && history.length > 1 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Performance
            </CardTitle>
            <CardDescription>
              Real-time metrics over the last {Math.round((history.length * 10) / 60)} minutes • 
              Current Queue: {history[history.length - 1]?.queueSize || 0} • 
              Success Rate: {Math.round(history[history.length - 1]?.successRate || 0)}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(34, 197, 94)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="rgb(34, 197, 94)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(239, 68, 68)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="rgb(239, 68, 68)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  yAxisId="left" 
                  className="text-xs" 
                  stroke="hsl(var(--muted-foreground))" 
                  label={{ value: 'Queue & Requests', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  className="text-xs" 
                  stroke="hsl(var(--muted-foreground))" 
                  domain={[0, 100]}
                  label={{ value: 'Success Rate %', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <RechartsTooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: any, name: string) => {
                    if (name === 'Success Rate') return [`${Math.round(value)}%`, name];
                    return [Math.round(value), name];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 600 }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="queueSize"
                  stroke="rgb(251, 191, 36)"
                  fill="url(#colorRequests)"
                  name="Queue Size"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="failedCount"
                  stroke="rgb(239, 68, 68)"
                  fill="url(#colorFailed)"
                  name="Failed in Queue"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="successRate"
                  stroke="rgb(34, 197, 94)"
                  name="Success Rate"
                  strokeWidth={3}
                  dot={{ r: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(251, 191, 36)' }}></div>
                <span className="text-muted-foreground">Queue Size</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(239, 68, 68)' }}></div>
                <span className="text-muted-foreground">Failed Items</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(34, 197, 94)' }}></div>
                <span className="text-muted-foreground">Success Rate</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canViewLogs && monitorData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Live Activity Feed */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest webhook requests</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={activityFilter === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActivityFilter('all')}
                    className="h-8 px-3"
                  >
                    All
                  </Button>
                  <Button
                    variant={activityFilter === 'success' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActivityFilter('success')}
                    className="h-8 px-3"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Success
                  </Button>
                  <Button
                    variant={activityFilter === 'failed' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActivityFilter('failed')}
                    className="h-8 px-3"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Failed
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {monitorData.recentActivity
                  .filter(activity => {
                    if (activityFilter === 'all') return true;
                    if (activityFilter === 'success') return activity.status === 'success';
                    if (activityFilter === 'failed') return activity.status === 'failed' || activity.status === 'partial_failure';
                    return true;
                  })
                  .slice(0, 15)
                  .map((activity) => {
                    const statusVariant = activity.status === 'success' ? 'default' : 
                                         activity.status === 'partial_failure' ? 'secondary' : 
                                         'destructive';
                    
                    const now = new Date();
                    const activityTime = new Date(activity.timestamp);
                    const diffMs = now.getTime() - activityTime.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const timeAgo = diffMins < 1 ? 'Just now' : 
                                   diffMins === 1 ? '1 min ago' : 
                                   diffMins < 60 ? `${diffMins} mins ago` : 
                                   `${Math.floor(diffMins / 60)}h ago`;
                    
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant="outline" className="shrink-0">
                            {activity.method}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{activity.apiEndpointName || 'Unknown'}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {timeAgo}
                            </div>
                          </div>
                        </div>
                        <TooltipProvider>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant={statusVariant} 
                                className="shrink-0 cursor-help"
                                onMouseEnter={() => fetchActivityDetails(activity.id)}
                              >
                                {activity.status}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <ActivityTooltipContent 
                                activity={activity} 
                                details={activityDetails[activity.id]} 
                              />
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                {monitorData.recentActivity.filter(activity => {
                  if (activityFilter === 'all') return true;
                  if (activityFilter === 'success') return activity.status === 'success';
                  if (activityFilter === 'failed') return activity.status === 'failed' || activity.status === 'partial_failure';
                  return true;
                }).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No {activityFilter !== 'all' ? activityFilter : ''} activity
                  </p>
                )}
              </div>
              {canViewLogs && monitorData.recentActivity.length > 0 && (
                <Button asChild variant="outline" size="sm" className="w-full mt-4">
                  <Link href="/dashboard/logs">
                    View All Logs
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Integration Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Integration Health
              </CardTitle>
              <CardDescription>Delivery performance (last hour)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {monitorData.integrationHealth.map((integration) => {
                  const successRate = integration.totalCount > 0
                    ? (integration.successCount / integration.totalCount) * 100
                    : 0;
                  
                  const healthColor = successRate >= 90 ? 'bg-green-500' : 
                                     successRate >= 70 ? 'bg-yellow-500' : 
                                     'bg-red-500';
                  
                  return (
                    <div key={integration.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${integration.enabled ? healthColor : 'bg-gray-400'}`}></div>
                          <div>
                            <p className="font-medium">{integration.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{integration.platform}</Badge>
                              <Badge variant={integration.enabled ? 'default' : 'secondary'} className="text-xs">
                                {integration.enabled ? 'Active' : 'Disabled'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {integration.totalCount > 0 && (
                          <div className="text-right">
                            <p className="text-2xl font-bold">{Math.round(successRate)}%</p>
                            <p className="text-xs text-muted-foreground">success</p>
                          </div>
                        )}
                      </div>
                      {integration.totalCount > 0 && (
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-muted-foreground">{integration.successCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-muted-foreground">{integration.failedCount}</span>
                          </div>
                          <div className="flex-1">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${healthColor} transition-all`}
                                style={{ width: `${successRate}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {monitorData.integrationHealth.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No integration activity in the last hour
                  </p>
                )}
              </div>
              {canViewIntegrations && (
                <Button asChild variant="outline" size="sm" className="w-full mt-4">
                  <Link href="/dashboard/integrations">
                    Manage Integrations
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {canViewLogs && monitorData && monitorData.recentActivity.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waypoints className="h-5 w-5" />
              Top Endpoints
            </CardTitle>
            <CardDescription>Most active webhook endpoints by request volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                // Calculate endpoint activity
                const endpointCounts = monitorData.recentActivity.reduce((acc, activity) => {
                  const name = activity.apiEndpointName || 'Unknown';
                  if (!acc[name]) {
                    acc[name] = { total: 0, success: 0, failed: 0 };
                  }
                  acc[name].total++;
                  if (activity.status === 'success') {
                    acc[name].success++;
                  } else {
                    acc[name].failed++;
                  }
                  return acc;
                }, {} as Record<string, { total: number; success: number; failed: number }>);

                // Sort by total count and take top 5
                const topEndpoints = Object.entries(endpointCounts)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .slice(0, 5);

                const maxCount = topEndpoints[0]?.[1].total || 1;

                return topEndpoints.map(([name, counts]) => {
                  const successRate = (counts.success / counts.total) * 100;
                  const widthPercent = (counts.total / maxCount) * 100;
                  
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate flex-1">{name}</span>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span className="text-xs">{counts.total} requests</span>
                          <span className={`text-xs font-medium ${successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {Math.round(successRate)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {canViewEndpoints && (
              <Button asChild variant="outline" size="sm" className="w-full mt-4">
                <Link href="/dashboard/settings/api">
                  Configure Endpoints
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
