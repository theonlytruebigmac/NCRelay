# Monitoring & Analytics Implementation Guide

This guide covers the implementation of real-time monitoring, analytics dashboards, and performance insights.

---

## 4. Real-Time Monitoring Dashboard

**Effort:** 4-6 hours
**Priority:** High
**Dependencies:** Prometheus metrics (already implemented)

### Component Architecture

```
/dashboard/monitor
├── Overview Cards (Active Integrations, Queue Size, Success Rate)
├── Live Activity Feed
├── Queue Status Chart
├── Performance Metrics
└── Alert Indicators
```

### Implementation Steps

#### Step 1: Create Monitoring API Endpoint
```typescript
// src/app/api/monitoring/live/route.ts

import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET() {
  const db = await getDB();

  // Queue Statistics
  const queueStats = db.prepare(`
    SELECT
      status,
      COUNT(*) as count,
      AVG(retryCount) as avgRetries
    FROM notification_queue
    GROUP BY status
  `).all();

  // Recent Activity (last 100 items)
  const recentActivity = db.prepare(`
    SELECT
      r.id,
      r.timestamp,
      r.method,
      r.apiEndpointId,
      r.status,
      e.name as endpointName
    FROM request_logs r
    LEFT JOIN api_endpoints e ON r.apiEndpointId = e.id
    ORDER BY r.timestamp DESC
    LIMIT 100
  `).all();

  // Integration Health
  const integrationHealth = db.prepare(`
    SELECT
      i.id,
      i.name,
      i.platform,
      i.enabled,
      COUNT(CASE WHEN nq.status = 'failed' THEN 1 END) as failedCount,
      COUNT(CASE WHEN nq.status = 'completed' THEN 1 END) as successCount
    FROM integrations i
    LEFT JOIN notification_queue nq ON nq.integrationId = i.id
      AND nq.createdAt > datetime('now', '-1 hour')
    GROUP BY i.id
  `).all();

  // System Metrics
  const systemMetrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };

  return NextResponse.json({
    queueStats,
    recentActivity,
    integrationHealth,
    systemMetrics,
    timestamp: new Date().toISOString()
  });
}
```

#### Step 2: Create Real-Time Dashboard Component
```typescript
// src/app/(app)/dashboard/monitor/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MonitorPage() {
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/monitoring/live');
      const newData = await res.json();
      setData(newData);

      // Keep history for charts (last 20 data points)
      setHistory(prev => [...prev, {
        timestamp: new Date(newData.timestamp).getTime(),
        queueSize: newData.queueStats.reduce((sum: number, s: any) => sum + s.count, 0),
        failedCount: newData.queueStats.find((s: any) => s.status === 'failed')?.count || 0
      }].slice(-20));
    };

    // Initial fetch
    fetchData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!data) return <div>Loading...</div>;

  const totalQueue = data.queueStats.reduce((sum: number, s: any) => sum + s.count, 0);
  const failedQueue = data.queueStats.find((s: any) => s.status === 'failed')?.count || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Real-Time Monitoring</h1>
        <p className="text-muted-foreground">Live system status and performance metrics</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium">Active Integrations</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.integrationHealth.filter((i: any) => i.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {data.integrationHealth.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const total = data.integrationHealth.reduce((sum: number, i: any) =>
                  sum + i.successCount + i.failedCount, 0);
                const success = data.integrationHealth.reduce((sum: number, i: any) =>
                  sum + i.successCount, 0);
                return total > 0 ? Math.round((success / total) * 100) : 100;
              })()}%
            </div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {failedQueue > 100 ? 'Degraded' : 'Healthy'}
            </div>
            <p className="text-xs text-muted-foreground">
              Uptime: {Math.floor(data.systemMetrics.uptime / 3600)}h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Trend (Last 2 minutes)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <Line type="monotone" dataKey="queueSize" stroke="#3b82f6" name="Queue Size" />
              <Line type="monotone" dataKey="failedCount" stroke="#ef4444" name="Failed" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Live Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Live Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.recentActivity.map((activity: any) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg animate-fade-in">
                <div className="flex items-center gap-3">
                  <Badge variant={activity.status === 'success' ? 'default' : 'destructive'}>
                    {activity.method}
                  </Badge>
                  <div>
                    <p className="font-medium text-sm">{activity.endpointName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Badge variant={activity.status === 'success' ? 'default' : 'destructive'}>
                  {activity.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Health */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Health (Last Hour)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.integrationHealth.map((integration: any) => (
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
                <Badge variant={integration.enabled ? 'default' : 'secondary'}>
                  {integration.enabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 5. Advanced Analytics Dashboard

**Effort:** 5-6 hours
**Priority:** High
**Dependencies:** Existing request logs

### Implementation Steps

#### Step 1: Create Analytics API
```typescript
// src/app/api/analytics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  const db = await getDB();
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '7');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Success/Failure Trends
  const trends = db.prepare(`
    SELECT
      DATE(timestamp) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failed
    FROM request_logs
    WHERE timestamp >= ?
    GROUP BY DATE(timestamp)
    ORDER BY date ASC
  `).all(startDate.toISOString());

  // Top Failing Integrations
  const topFailures = db.prepare(`
    SELECT
      i.name,
      i.platform,
      COUNT(*) as failureCount
    FROM notification_queue nq
    JOIN integrations i ON nq.integrationId = i.id
    WHERE nq.status = 'failed'
      AND nq.createdAt >= ?
    GROUP BY i.id
    ORDER BY failureCount DESC
    LIMIT 10
  `).all(startDate.toISOString());

  // Peak Usage Times
  const peakUsage = db.prepare(`
    SELECT
      CAST(strftime('%H', timestamp) AS INTEGER) as hour,
      COUNT(*) as count
    FROM request_logs
    WHERE timestamp >= ?
    GROUP BY hour
    ORDER BY count DESC
  `).all(startDate.toISOString());

  // Average Delivery Time by Platform
  const deliveryTimes = db.prepare(`
    SELECT
      i.platform,
      AVG(CAST((julianday(nq.completedAt) - julianday(nq.createdAt)) * 24 * 60 * 60 * 1000 AS INTEGER)) as avgMs
    FROM notification_queue nq
    JOIN integrations i ON nq.integrationId = i.id
    WHERE nq.completedAt IS NOT NULL
      AND nq.createdAt >= ?
    GROUP BY i.platform
  `).all(startDate.toISOString());

  // Integration Performance Comparison
  const integrationPerformance = db.prepare(`
    SELECT
      i.id,
      i.name,
      i.platform,
      COUNT(*) as total,
      SUM(CASE WHEN nq.status = 'completed' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN nq.status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(nq.retryCount) as avgRetries
    FROM integrations i
    LEFT JOIN notification_queue nq ON i.id = nq.integrationId
      AND nq.createdAt >= ?
    GROUP BY i.id
    ORDER BY total DESC
  `).all(startDate.toISOString());

  return NextResponse.json({
    trends,
    topFailures,
    peakUsage,
    deliveryTimes,
    integrationPerformance,
    period: { days, startDate: startDate.toISOString() }
  });
}
```

#### Step 2: Create Analytics Dashboard Page
```typescript
// src/app/(app)/dashboard/analytics/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState('7');

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/analytics?days=${period}`);
      const analyticsData = await res.json();
      setData(analyticsData);
    };

    fetchData();
  }, [period]);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Insights and performance metrics</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Success/Failure Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Success vs Failure Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="success" stroke="#10b981" name="Success" />
              <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Failing Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Failing Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topFailures}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="failureCount" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average Delivery Time */}
        <Card>
          <CardHeader>
            <CardTitle>Average Delivery Time by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.deliveryTimes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip formatter={(value) => `${value}ms`} />
                <Bar dataKey="avgMs" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Peak Usage Times */}
      <Card>
        <CardHeader>
          <CardTitle>Peak Usage Times</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.peakUsage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis />
              <Tooltip labelFormatter={(hour) => `${hour}:00`} />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Integration Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left p-3">Integration</th>
                  <th className="text-left p-3">Platform</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3">Success</th>
                  <th className="text-right p-3">Failed</th>
                  <th className="text-right p-3">Success Rate</th>
                  <th className="text-right p-3">Avg Retries</th>
                </tr>
              </thead>
              <tbody>
                {data.integrationPerformance.map((integration: any) => {
                  const successRate = integration.total > 0
                    ? ((integration.success / integration.total) * 100).toFixed(1)
                    : '0';

                  return (
                    <tr key={integration.id} className="border-b hover:bg-muted/10">
                      <td className="p-3 font-medium">{integration.name}</td>
                      <td className="p-3">
                        <Badge>{integration.platform}</Badge>
                      </td>
                      <td className="p-3 text-right">{integration.total}</td>
                      <td className="p-3 text-right text-green-600">{integration.success}</td>
                      <td className="p-3 text-right text-red-600">{integration.failed}</td>
                      <td className="p-3 text-right">
                        <Badge variant={parseFloat(successRate) >= 95 ? 'default' : 'destructive'}>
                          {successRate}%
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{integration.avgRetries?.toFixed(2) || '0'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 6. Notification Retry Management

**Effort:** 4-5 hours
**Priority:** High
**Dependencies:** Existing notification queue

### Implementation Steps

#### Step 1: Add Retry Management API
```typescript
// src/app/api/queue/manage/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { action, ids, filters } = await request.json();
  const db = await getDB();

  switch (action) {
    case 'retry':
      // Retry specific notifications
      db.prepare(`
        UPDATE notification_queue
        SET status = 'pending', nextRetryAt = datetime('now')
        WHERE id IN (${ids.map(() => '?').join(',')})
      `).run(...ids);
      break;

    case 'retry-failed':
      // Retry all failed notifications
      db.prepare(`
        UPDATE notification_queue
        SET status = 'pending', nextRetryAt = datetime('now')
        WHERE status = 'failed'
      `).run();
      break;

    case 'cancel':
      // Cancel specific notifications
      db.prepare(`
        DELETE FROM notification_queue
        WHERE id IN (${ids.map(() => '?').join(',')})
      `).run(...ids);
      break;

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const db = await getDB();
  const searchParams = request.nextUrl.searchParams;

  const status = searchParams.get('status');
  const integrationId = searchParams.get('integrationId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = 'SELECT * FROM notification_queue WHERE 1=1';
  const params: any[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (integrationId) {
    query += ' AND integrationId = ?';
    params.push(integrationId);
  }

  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, (page - 1) * limit);

  const items = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM notification_queue').get() as { count: number };

  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit)
    }
  });
}
```

#### Step 2: Create Queue Management Page
```typescript
// src/app/(app)/dashboard/queue/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Trash2, Filter } from 'lucide-react';

export default function QueueManagementPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  const loadQueue = async () => {
    const params = new URLSearchParams({
      page: page.toString(),
      ...(statusFilter !== 'all' && { status: statusFilter })
    });

    const res = await fetch(`/api/queue/manage?${params}`);
    const data = await res.json();
    setItems(data.items);
    setPagination(data.pagination);
  };

  useEffect(() => {
    loadQueue();
  }, [page, statusFilter]);

  const retrySelected = async () => {
    await fetch('/api/queue/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry', ids: Array.from(selected) })
    });
    setSelected(new Set());
    loadQueue();
  };

  const retryAllFailed = async () => {
    if (!confirm('Retry all failed notifications?')) return;

    await fetch('/api/queue/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry-failed' })
    });
    loadQueue();
  };

  const cancelSelected = async () => {
    if (!confirm('Cancel selected notifications?')) return;

    await fetch('/api/queue/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', ids: Array.from(selected) })
    });
    setSelected(new Set());
    loadQueue();
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Queue Management</h1>
          <p className="text-muted-foreground">Manage and retry failed notifications</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadQueue} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="font-medium">{selected.size} items selected</p>
            <div className="flex gap-2">
              <Button onClick={retrySelected} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Selected
              </Button>
              <Button onClick={cancelSelected} variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notification Queue</CardTitle>
            <Button onClick={retryAllFailed} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry All Failed
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/5"
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggleSelect(item.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={
                      item.status === 'completed' ? 'default' :
                      item.status === 'failed' ? 'destructive' :
                      'secondary'
                    }>
                      {item.status}
                    </Badge>
                    <span className="text-sm font-medium">{item.integrationId}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(item.createdAt).toLocaleString()}
                    {item.nextRetryAt && ` • Next retry: ${new Date(item.nextRetryAt).toLocaleString()}`}
                    {item.error && ` • Error: ${item.error.substring(0, 100)}...`}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Retries: {item.retryCount}/{item.maxRetries}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

*Continue with remaining features...*

Let me continue creating guides for the remaining features. Should I keep adding to these files or create additional focused documents?
