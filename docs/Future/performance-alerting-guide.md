# Performance & Alerting Implementation Guide

This guide covers implementing performance optimizations and system alerting features.

## Features Covered

1. **Parallel Webhook Delivery** - Concurrent webhook processing for improved throughput
2. **Request Caching** - In-memory caching to reduce database load
3. **Alerting & Notifications System** - Email/Slack alerts for system issues

---

## Feature 14: Parallel Webhook Delivery

### Overview
Process webhooks concurrently instead of sequentially to improve throughput and reduce latency for endpoints with multiple integrations.

**Effort Estimate**: 6-8 hours

### Database Schema

Already included in migration 018:
- `integrations.maxConcurrency` column to control parallel delivery limits

### Step 1: Create Parallel Delivery Service

**File**: `src/lib/parallel-delivery.ts`

```typescript
import { logger } from './logger';

export interface DeliveryTask {
  id: string;
  integration: any;
  payload: any;
  deliver: () => Promise<void>;
}

export class ParallelDeliveryQueue {
  private maxConcurrency: number;
  private activeCount: number = 0;
  private queue: DeliveryTask[] = [];
  private results: Map<string, { success: boolean; error?: Error }> = new Map();

  constructor(maxConcurrency: number = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Add a delivery task to the queue
   */
  addTask(task: DeliveryTask): void {
    this.queue.push(task);
  }

  /**
   * Process all tasks in parallel with concurrency limit
   */
  async processAll(): Promise<Map<string, { success: boolean; error?: Error }>> {
    logger.info('Starting parallel delivery', {
      totalTasks: this.queue.length,
      maxConcurrency: this.maxConcurrency
    });

    const startTime = Date.now();

    // Process tasks until queue is empty
    const promises: Promise<void>[] = [];

    while (this.queue.length > 0 || this.activeCount > 0) {
      // Fill up to max concurrency
      while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
        const task = this.queue.shift();
        if (task) {
          promises.push(this.processTask(task));
        }
      }

      // Wait for at least one task to complete before checking again
      if (this.activeCount >= this.maxConcurrency) {
        await Promise.race(promises);
      }
    }

    // Wait for all remaining tasks to complete
    await Promise.allSettled(promises);

    const duration = Date.now() - startTime;
    const successCount = Array.from(this.results.values()).filter(r => r.success).length;

    logger.info('Parallel delivery completed', {
      total: this.results.size,
      successful: successCount,
      failed: this.results.size - successCount,
      durationMs: duration
    });

    return this.results;
  }

  /**
   * Process a single task
   */
  private async processTask(task: DeliveryTask): Promise<void> {
    this.activeCount++;

    try {
      await task.deliver();
      this.results.set(task.id, { success: true });
    } catch (error) {
      logger.error('Delivery task failed', {
        taskId: task.id,
        integrationId: task.integration.id,
        error
      });
      this.results.set(task.id, {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
    } finally {
      this.activeCount--;
    }
  }

  /**
   * Get delivery results
   */
  getResults(): Map<string, { success: boolean; error?: Error }> {
    return this.results;
  }
}

/**
 * Deliver webhooks to all integrations in parallel
 */
export async function deliverWebhooksParallel(
  integrations: any[],
  payload: any,
  deliveryFn: (integration: any, payload: any) => Promise<void>,
  maxConcurrency: number = 5
): Promise<{ successful: number; failed: number; results: Map<string, any> }> {
  const queue = new ParallelDeliveryQueue(maxConcurrency);

  // Add all integrations as tasks
  for (const integration of integrations) {
    queue.addTask({
      id: integration.id,
      integration,
      payload,
      deliver: async () => {
        await deliveryFn(integration, payload);
      }
    });
  }

  // Process all tasks
  const results = await queue.processAll();

  const successful = Array.from(results.values()).filter(r => r.success).length;
  const failed = results.size - successful;

  return { successful, failed, results };
}
```

### Step 2: Update Webhook Processing

**Update**: `src/app/api/webhook/[slug]/route.ts`

```typescript
import { deliverWebhooksParallel } from '@/lib/parallel-delivery';
import { deliverNotification } from '@/lib/notification-delivery';

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // ... existing endpoint lookup and validation ...

    const integrations = await getIntegrationsForEndpoint(endpoint.id);

    if (integrations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No integrations configured'
      });
    }

    // Determine max concurrency (use highest from integrations or default)
    const maxConcurrency = Math.max(
      ...integrations.map(i => i.maxConcurrency || 1),
      5
    );

    // Deliver to all integrations in parallel
    const deliveryResults = await deliverWebhooksParallel(
      integrations,
      payload,
      async (integration, data) => {
        await deliverNotification(integration, data);
      },
      maxConcurrency
    );

    logger.info('Webhook delivered to integrations', {
      endpointId: endpoint.id,
      successful: deliveryResults.successful,
      failed: deliveryResults.failed,
      maxConcurrency
    });

    return NextResponse.json({
      success: true,
      message: `Delivered to ${deliveryResults.successful}/${integrations.length} integrations`,
      stats: {
        total: integrations.length,
        successful: deliveryResults.successful,
        failed: deliveryResults.failed
      }
    });
  } catch (error) {
    logger.error('Webhook processing failed', { error, slug: params.slug });
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
```

### Step 3: Add Concurrency Configuration UI

**Update**: Integration edit form to include maxConcurrency:

```typescript
<div>
  <Label htmlFor="maxConcurrency">Max Concurrent Deliveries</Label>
  <Input
    id="maxConcurrency"
    type="number"
    min="1"
    max="10"
    value={formData.maxConcurrency || 1}
    onChange={(e) => setFormData({
      ...formData,
      maxConcurrency: parseInt(e.target.value)
    })}
  />
  <p className="text-xs text-muted-foreground mt-1">
    Number of webhooks to deliver concurrently (1-10, higher = faster but more resource intensive)
  </p>
</div>
```

---

## Feature 15: Request Caching

### Overview
Implement in-memory caching for frequently accessed data (metrics, statistics, configuration) to reduce database load and improve response times.

**Effort Estimate**: 6-8 hours

### Database Schema

Already included in migration 018:
- `metrics_cache` table for persistent cache storage

### Step 1: Create Cache Service

**File**: `src/lib/cache.ts`

```typescript
import { getDB } from './db';
import { logger } from './logger';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs: number = 60000) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);

    logger.info('Memory cache initialized');
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache with TTL in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  /**
   * Delete key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    logger.info('Cache invalidated by pattern', { pattern, count });
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug('Cache cleanup completed', { removed: count });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    logger.info('Memory cache destroyed');
  }
}

// Global cache instance
export const cache = new MemoryCache();

/**
 * Cache wrapper for async functions
 */
export async function cached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try to get from cache
  const cached = cache.get<T>(key);
  if (cached !== null) {
    logger.debug('Cache hit', { key });
    return cached;
  }

  // Fetch and cache
  logger.debug('Cache miss', { key });
  const value = await fetchFn();
  cache.set(key, value, ttlSeconds);

  return value;
}

/**
 * Persistent cache using database
 */
export async function getPersistentCache<T>(key: string): Promise<T | null> {
  const db = await getDB();

  try {
    const result = db.prepare(`
      SELECT value FROM metrics_cache
      WHERE key = ? AND expiresAt > datetime('now')
    `).get(key) as { value: string } | undefined;

    if (!result) return null;

    return JSON.parse(result.value) as T;
  } catch (error) {
    logger.error('Failed to get persistent cache', { error, key });
    return null;
  }
}

/**
 * Set persistent cache in database
 */
export async function setPersistentCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = 3600
): Promise<void> {
  const db = await getDB();

  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO metrics_cache (key, value, expiresAt)
      VALUES (?, ?, ?)
    `).run(key, JSON.stringify(value), expiresAt);
  } catch (error) {
    logger.error('Failed to set persistent cache', { error, key });
  }
}
```

### Step 2: Apply Caching to Expensive Operations

**File**: `src/lib/cached-queries.ts`

```typescript
import { cached, cache } from './cache';
import { getDB } from './db';

/**
 * Get dashboard statistics with caching
 */
export async function getDashboardStats() {
  return cached('dashboard:stats', async () => {
    const db = await getDB();

    const endpointsCount = db.prepare('SELECT COUNT(*) as count FROM api_endpoints').get() as { count: number };
    const integrationsCount = db.prepare('SELECT COUNT(*) as count FROM integrations').get() as { count: number };
    const requestsToday = db.prepare(`
      SELECT COUNT(*) as count FROM request_logs
      WHERE timestamp > datetime('now', '-1 day')
    `).get() as { count: number };
    const queuePending = db.prepare(`
      SELECT COUNT(*) as count FROM notification_queue
      WHERE status = 'pending'
    `).get() as { count: number };

    return {
      endpoints: endpointsCount.count,
      integrations: integrationsCount.count,
      requestsToday: requestsToday.count,
      queuePending: queuePending.count
    };
  }, 30); // Cache for 30 seconds
}

/**
 * Get request statistics with caching
 */
export async function getRequestStats(period: '24h' | '7d' | '30d') {
  return cached(`stats:requests:${period}`, async () => {
    const db = await getDB();

    const since = period === '24h' ? '-1 day' : period === '7d' ? '-7 days' : '-30 days';

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM request_logs
      WHERE timestamp > datetime('now', ?)
    `).get(since) as { total: number; successful: number; failed: number };

    return stats;
  }, period === '24h' ? 60 : 300); // 1 min for 24h, 5 min for longer periods
}

/**
 * Get endpoint performance metrics with caching
 */
export async function getEndpointPerformance(endpointId: string) {
  return cached(`performance:endpoint:${endpointId}`, async () => {
    const db = await getDB();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as totalRequests,
        AVG(CAST(json_extract(payload, '$.processingTime') as INTEGER)) as avgProcessingTime,
        MAX(CAST(json_extract(payload, '$.processingTime') as INTEGER)) as maxProcessingTime
      FROM request_logs
      WHERE apiEndpointId = ?
        AND timestamp > datetime('now', '-24 hours')
    `).get(endpointId) as any;

    return stats;
  }, 120); // Cache for 2 minutes
}

/**
 * Invalidate cache when data changes
 */
export function invalidateEndpointCache(endpointId: string): void {
  cache.delete('dashboard:stats');
  cache.invalidatePattern(`^stats:`);
  cache.invalidatePattern(`^performance:endpoint:${endpointId}`);
}

export function invalidateIntegrationCache(): void {
  cache.delete('dashboard:stats');
  cache.invalidatePattern(`^stats:`);
}
```

### Step 3: Use Cached Queries in Dashboard

**Update**: `src/app/(dashboard)/page.tsx`

```typescript
import { getDashboardStats, getRequestStats } from '@/lib/cached-queries';

export default async function DashboardPage() {
  // These will be cached and reused across requests
  const stats = await getDashboardStats();
  const requestStats24h = await getRequestStats('24h');

  return (
    <div>
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.endpoints}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.integrations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.requestsToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.queuePending}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### Step 4: Invalidate Cache on Mutations

**Update**: Endpoint/Integration API routes:

```typescript
import { invalidateEndpointCache } from '@/lib/cached-queries';

// After creating/updating/deleting endpoint
invalidateEndpointCache(endpointId);
```

---

## Feature 16: Alerting & Notifications System

### Overview
Send email or Slack alerts when system issues occur (high queue depth, delivery failures, downtime).

**Effort Estimate**: 10-12 hours

### Database Schema

Already included in migration 018:
- `alert_settings` table

### Step 1: Create Alerting Service

**File**: `src/lib/alerting.ts`

```typescript
import { getDB } from './db';
import { logger } from './logger';
import nodemailer from 'nodemailer';
import { getEnv } from './env';

export type AlertType = 'high_queue_depth' | 'high_failure_rate' | 'system_down' | 'disk_space_low';

export interface AlertSettings {
  id: string;
  type: AlertType;
  enabled: boolean;
  threshold?: number;
  recipients: string; // JSON array of email addresses or Slack webhook URLs
  createdAt: string;
  updatedAt: string;
}

export interface AlertContext {
  type: AlertType;
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
}

/**
 * Get alert settings by type
 */
export async function getAlertSettings(type: AlertType): Promise<AlertSettings | null> {
  const db = await getDB();

  return db.prepare('SELECT * FROM alert_settings WHERE type = ?').get(type) as AlertSettings | null;
}

/**
 * Create or update alert settings
 */
export async function setAlertSettings(
  type: AlertType,
  enabled: boolean,
  threshold: number | null,
  recipients: string[]
): Promise<void> {
  const db = await getDB();

  const existing = await getAlertSettings(type);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE alert_settings
      SET enabled = ?, threshold = ?, recipients = ?, updatedAt = ?
      WHERE type = ?
    `).run(enabled ? 1 : 0, threshold, JSON.stringify(recipients), now, type);
  } else {
    db.prepare(`
      INSERT INTO alert_settings (id, type, enabled, threshold, recipients, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `alert_${type}_${Date.now()}`,
      type,
      enabled ? 1 : 0,
      threshold,
      JSON.stringify(recipients),
      now,
      now
    );
  }
}

/**
 * Check if alert should be sent (rate limiting)
 */
const lastAlertTimes = new Map<string, number>();
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

function shouldSendAlert(type: AlertType): boolean {
  const lastTime = lastAlertTimes.get(type);
  if (!lastTime) return true;

  const elapsed = Date.now() - lastTime;
  return elapsed > ALERT_COOLDOWN_MS;
}

/**
 * Send alert notification
 */
export async function sendAlert(context: AlertContext): Promise<void> {
  try {
    const settings = await getAlertSettings(context.type);

    if (!settings || !settings.enabled) {
      logger.debug('Alert disabled, skipping', { type: context.type });
      return;
    }

    // Rate limiting
    if (!shouldSendAlert(context.type)) {
      logger.debug('Alert in cooldown period, skipping', { type: context.type });
      return;
    }

    const recipients = JSON.parse(settings.recipients) as string[];

    // Send to all recipients
    for (const recipient of recipients) {
      if (recipient.includes('@')) {
        // Email
        await sendEmailAlert(recipient, context);
      } else if (recipient.startsWith('https://hooks.slack.com/')) {
        // Slack webhook
        await sendSlackAlert(recipient, context);
      }
    }

    // Update last alert time
    lastAlertTimes.set(context.type, Date.now());

    logger.info('Alert sent', { type: context.type, recipients: recipients.length });
  } catch (error) {
    logger.error('Failed to send alert', { error, type: context.type });
  }
}

/**
 * Send email alert
 */
async function sendEmailAlert(to: string, context: AlertContext): Promise<void> {
  const env = getEnv();

  // Configure your SMTP settings
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: env.SMTP_PORT || 587,
    secure: false,
    auth: env.SMTP_USER && env.SMTP_PASS ? {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    } : undefined
  });

  const subject = `[${context.severity.toUpperCase()}] NCRelay Alert: ${context.type}`;
  const html = `
    <h2>NCRelay System Alert</h2>
    <p><strong>Type:</strong> ${context.type}</p>
    <p><strong>Severity:</strong> ${context.severity}</p>
    <p><strong>Message:</strong> ${context.message}</p>
    <h3>Details:</h3>
    <pre>${JSON.stringify(context.details, null, 2)}</pre>
    <p><small>Sent at ${new Date().toISOString()}</small></p>
  `;

  await transporter.sendMail({
    from: env.SMTP_FROM || 'noreply@ncrelay.local',
    to,
    subject,
    html
  });

  logger.info('Email alert sent', { to, type: context.type });
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(webhookUrl: string, context: AlertContext): Promise<void> {
  const color = context.severity === 'critical' ? '#FF0000' : '#FFA500';

  const payload = {
    attachments: [
      {
        color,
        title: `NCRelay Alert: ${context.type}`,
        fields: [
          {
            title: 'Severity',
            value: context.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: new Date().toISOString(),
            short: true
          },
          {
            title: 'Message',
            value: context.message,
            short: false
          },
          {
            title: 'Details',
            value: `\`\`\`${JSON.stringify(context.details, null, 2)}\`\`\``,
            short: false
          }
        ]
      }
    ]
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  logger.info('Slack alert sent', { type: context.type });
}

/**
 * Check queue depth and send alert if threshold exceeded
 */
export async function checkQueueDepth(): Promise<void> {
  const settings = await getAlertSettings('high_queue_depth');
  if (!settings || !settings.enabled) return;

  const db = await getDB();
  const result = db.prepare(
    "SELECT COUNT(*) as count FROM notification_queue WHERE status = 'pending'"
  ).get() as { count: number };

  const threshold = settings.threshold || 1000;

  if (result.count > threshold) {
    await sendAlert({
      type: 'high_queue_depth',
      severity: result.count > threshold * 2 ? 'critical' : 'warning',
      message: `Notification queue depth is high: ${result.count} pending items`,
      details: {
        queueDepth: result.count,
        threshold,
        percentOverThreshold: ((result.count / threshold - 1) * 100).toFixed(1)
      }
    });
  }
}

/**
 * Check delivery failure rate and alert if high
 */
export async function checkFailureRate(): Promise<void> {
  const settings = await getAlertSettings('high_failure_rate');
  if (!settings || !settings.enabled) return;

  const db = await getDB();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM notification_queue
    WHERE createdAt > datetime('now', '-1 hour')
  `).get() as { total: number; failed: number };

  if (stats.total === 0) return;

  const failureRate = (stats.failed / stats.total) * 100;
  const threshold = settings.threshold || 20; // 20% default

  if (failureRate > threshold) {
    await sendAlert({
      type: 'high_failure_rate',
      severity: failureRate > threshold * 2 ? 'critical' : 'warning',
      message: `High webhook delivery failure rate: ${failureRate.toFixed(1)}%`,
      details: {
        failureRate: failureRate.toFixed(1),
        failed: stats.failed,
        total: stats.total,
        threshold
      }
    });
  }
}
```

### Step 2: Create Alert Monitoring Job

**File**: `src/lib/scheduled-tasks.ts` (update existing file)

```typescript
import { checkQueueDepth, checkFailureRate } from './alerting';
import { logger } from './logger';

/**
 * Start alert monitoring (check every 5 minutes)
 */
export function startAlertMonitoring(): void {
  // Run immediately
  runAlertChecks();

  // Then every 5 minutes
  setInterval(() => {
    runAlertChecks();
  }, 5 * 60 * 1000);

  logger.info('Alert monitoring started (5 minute intervals)');
}

async function runAlertChecks(): Promise<void> {
  try {
    await checkQueueDepth();
    await checkFailureRate();
  } catch (error) {
    logger.error('Alert check failed', { error });
  }
}
```

**Update**: `server.js`

```typescript
import { startAlertMonitoring } from './src/lib/scheduled-tasks.js';

// After migrations
startAlertMonitoring();
```

### Step 3: Create Alert Settings API Routes

**File**: `src/app/api/alerts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { setAlertSettings } from '@/lib/alerting';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDB();
    const settings = db.prepare('SELECT * FROM alert_settings').all();

    return NextResponse.json(settings);
  } catch (error) {
    logger.error('Failed to fetch alert settings', { error });
    return NextResponse.json(
      { error: 'Failed to fetch alert settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, enabled, threshold, recipients } = body;

    if (!type || !Array.isArray(recipients)) {
      return NextResponse.json(
        { error: 'Type and recipients are required' },
        { status: 400 }
      );
    }

    await setAlertSettings(type, enabled, threshold, recipients);

    logger.info('Alert settings updated', { type, userId: user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to update alert settings', { error });
    return NextResponse.json(
      { error: 'Failed to update alert settings' },
      { status: 500 }
    );
  }
}
```

### Step 4: Create Alert Settings UI

**File**: `src/app/(dashboard)/settings/alerts/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AlertSetting {
  id: string;
  type: string;
  enabled: boolean;
  threshold?: number;
  recipients: string;
  createdAt: string;
  updatedAt: string;
}

export default function AlertSettingsPage() {
  const [settings, setSettings] = useState<AlertSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const alertTypes = [
    {
      type: 'high_queue_depth',
      name: 'High Queue Depth',
      description: 'Alert when notification queue exceeds threshold',
      defaultThreshold: 1000
    },
    {
      type: 'high_failure_rate',
      name: 'High Failure Rate',
      description: 'Alert when webhook delivery failure rate exceeds threshold (%)',
      defaultThreshold: 20
    },
    {
      type: 'system_down',
      name: 'System Down',
      description: 'Alert when system health checks fail',
      defaultThreshold: null
    },
    {
      type: 'disk_space_low',
      name: 'Low Disk Space',
      description: 'Alert when disk space falls below threshold (%)',
      defaultThreshold: 10
    }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch alert settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveAlertSetting(type: string, enabled: boolean, threshold: number | null, recipients: string) {
    try {
      const recipientList = recipients.split('\n').map(r => r.trim()).filter(r => r);

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          enabled,
          threshold,
          recipients: recipientList
        })
      });

      if (!res.ok) throw new Error('Failed to save');

      toast({
        title: 'Success',
        description: 'Alert settings saved'
      });

      fetchSettings();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save alert settings',
        variant: 'destructive'
      });
    }
  }

  function getSettingForType(type: string): AlertSetting | undefined {
    return settings.find(s => s.type === type);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Alert Settings</h1>
        <p className="text-muted-foreground">
          Configure system alerts and notifications
        </p>
      </div>

      <div className="grid gap-6">
        {alertTypes.map(alertType => {
          const setting = getSettingForType(alertType.type);
          const [enabled, setEnabled] = useState(setting?.enabled || false);
          const [threshold, setThreshold] = useState(setting?.threshold || alertType.defaultThreshold || 0);
          const [recipients, setRecipients] = useState(
            setting ? JSON.parse(setting.recipients).join('\n') : ''
          );

          return (
            <Card key={alertType.type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      {alertType.name}
                    </CardTitle>
                    <CardDescription>{alertType.description}</CardDescription>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {alertType.defaultThreshold !== null && (
                  <div>
                    <Label>Threshold</Label>
                    <Input
                      type="number"
                      value={threshold}
                      onChange={(e) => setThreshold(parseInt(e.target.value))}
                      disabled={!enabled}
                    />
                  </div>
                )}

                <div>
                  <Label>Recipients (one per line)</Label>
                  <Textarea
                    placeholder="email@example.com&#10;https://hooks.slack.com/services/..."
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    disabled={!enabled}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email addresses or Slack webhook URLs
                  </p>
                </div>

                <Button
                  onClick={() => saveAlertSetting(alertType.type, enabled, threshold, recipients)}
                  disabled={!enabled}
                >
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <CardDescription>
            Configure email settings in your environment variables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-background p-4 rounded">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@ncrelay.local`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Testing Performance & Alerting Features

### Test Parallel Delivery

1. Create an endpoint with 5+ integrations
2. Send a webhook and check logs for concurrent delivery
3. Monitor performance improvement vs sequential
4. Adjust maxConcurrency settings and compare

### Test Request Caching

1. Access dashboard multiple times quickly
2. Check logs for cache hits/misses
3. Modify data and verify cache invalidation
4. Monitor database query reduction

### Test Alerting

1. Configure alert for high queue depth (low threshold for testing)
2. Send many webhooks to trigger the alert
3. Verify email/Slack notification received
4. Test cooldown period (no duplicate alerts)
5. Configure different alert types

---

## Environment Variables for New Features

Add to your `.env.local`:

```env
# SMTP Configuration (for email alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@ncrelay.local

# Cache Configuration (optional)
CACHE_TTL_SECONDS=300
CACHE_CLEANUP_INTERVAL_MS=60000

# Alert Configuration (optional)
ALERT_COOLDOWN_MINUTES=15
```

---

## Performance Monitoring

Monitor the impact of these features:

```typescript
// In your monitoring dashboard
import { cache } from '@/lib/cache';

const cacheStats = cache.getStats();
console.log('Cache size:', cacheStats.size);
console.log('Cached keys:', cacheStats.keys);
```

