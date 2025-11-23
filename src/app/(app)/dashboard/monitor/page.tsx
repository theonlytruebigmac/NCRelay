"use client";

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface MonitoringData {
  queueStats: Array<{ status: string; count: number; avgRetries: number }>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    method: string;
    apiEndpointName: string;
    status: string;
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
    avgResponseTime: number;
    queueDepth: number;
  };
  systemMetrics: {
    uptime: number;
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
    cpu: {
      user: number;
      system: number;
    };
  };
  timestamp: string;
}

interface ChartDataPoint {
  timestamp: number;
  queueSize: number;
  failedCount: number;
  successRate: number;
}

export default function MonitorPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [history, setHistory] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const res = await fetch('/api/monitoring/live');
      if (!res.ok) throw new Error('Failed to fetch monitoring data');
      
      const newData: MonitoringData = await res.json();
      setData(newData);

      // Update history for charts (keep last 20 data points)
      setHistory(prev => {
        const queueSize = newData.queueStats.reduce((sum, s) => sum + s.count, 0);
        const failedCount = newData.queueStats.find(s => s.status === 'failed')?.count || 0;
        
        return [...prev, {
          timestamp: new Date(newData.timestamp).getTime(),
          queueSize,
          failedCount,
          successRate: newData.overview.successRate
        }].slice(-20);
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch monitoring data"
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Auto-refresh every 5 seconds
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchData, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  if (loading || !data) {
    return (
      <PageShell
        title="Real-Time Monitoring"
        description="Live system status and performance metrics"
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  const totalQueue = data.queueStats.reduce((sum, s) => sum + s.count, 0);
  const failedQueue = data.queueStats.find(s => s.status === 'failed')?.count || 0;
  const systemHealth = failedQueue > 100 ? 'Degraded' : data.overview.queueDepth > 1000 ? 'Warning' : 'Healthy';

  return (
    <PageShell
      title="Real-Time Monitoring"
      description="Live system status and performance metrics"
      actions={
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-Refresh' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              {systemHealth === 'Healthy' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : systemHealth === 'Warning' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth}</div>
              <p className="text-xs text-muted-foreground">
                Uptime: {Math.floor(data.systemMetrics.uptime / 3600)}h {Math.floor((data.systemMetrics.uptime % 3600) / 60)}m
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalQueue}</div>
              <p className="text-xs text-muted-foreground">
                {failedQueue} failed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.successRate}%</div>
              <p className="text-xs text-muted-foreground">
                Last 100 requests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Queue Depth</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.queueDepth}</div>
              <p className="text-xs text-muted-foreground">
                Pending notifications
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Resources</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.activeEndpoints}</div>
              <p className="text-xs text-muted-foreground">
                {data.overview.activeIntegrations} integrations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Queue Trend Chart */}
        {history.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Queue Trend (Last {Math.round((history.length * 5) / 60)} minutes)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="queueSize"
                    stroke="#3b82f6"
                    name="Queue Size"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="failedCount"
                    stroke="#ef4444"
                    name="Failed"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="successRate"
                    stroke="#10b981"
                    name="Success Rate %"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Live Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {data.recentActivity.slice(0, 20).map((activity) => {
                  const statusVariant = activity.status === 'success' ? 'default' : 
                                       activity.status === 'partial_failure' ? 'secondary' : 
                                       'destructive';
                  
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">
                          {activity.method}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{activity.apiEndpointName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={statusVariant}>
                        {activity.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Integration Health */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Health (Last Hour)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {data.integrationHealth.map((integration) => {
                  const successRate = integration.totalCount > 0
                    ? (integration.successCount / integration.totalCount) * 100
                    : 0;
                  
                  return (
                    <div key={integration.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge>{integration.platform}</Badge>
                        <div>
                          <p className="font-medium">{integration.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {integration.successCount} success, {integration.failedCount} failed
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={integration.enabled ? 'default' : 'secondary'}>
                          {integration.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        {integration.totalCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {Math.round(successRate)}% success
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {data.integrationHealth.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No integration activity in the last hour
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Memory Usage</p>
                <p className="text-2xl font-bold">
                  {Math.round(data.systemMetrics.memory.heapUsed / 1024 / 1024)}MB
                </p>
                <p className="text-xs text-muted-foreground">
                  of {Math.round(data.systemMetrics.memory.heapTotal / 1024 / 1024)}MB heap
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">RSS Memory</p>
                <p className="text-2xl font-bold">
                  {Math.round(data.systemMetrics.memory.rss / 1024 / 1024)}MB
                </p>
                <p className="text-xs text-muted-foreground">
                  Resident set size
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">CPU Time</p>
                <p className="text-2xl font-bold">
                  {Math.round((data.systemMetrics.cpu.user + data.systemMetrics.cpu.system) / 1000)}ms
                </p>
                <p className="text-xs text-muted-foreground">
                  User + System
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <p className="text-xs text-center text-muted-foreground">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </p>
      </div>
    </PageShell>
  );
}
