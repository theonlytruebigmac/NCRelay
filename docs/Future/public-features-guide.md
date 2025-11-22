# Public Features Implementation Guide

This guide covers implementing public-facing features that enhance transparency and developer experience.

## Features Covered

1. **Public Health Status Page** - Publicly accessible system status page
2. **Interactive API Documentation** - Auto-generated OpenAPI/Swagger documentation

---

## Feature 7: Public Health Status Page

### Overview
A public-facing status page that shows system health, uptime, and service availability without requiring authentication. Provides transparency to users and reduces support burden.

**Effort Estimate**: 6-8 hours

### Database Schema

Already included in migration 018:
- `metrics_cache` table for storing historical uptime data
- `alert_settings` table for incident notifications

### Step 1: Create Uptime Tracking Service

**File**: `src/lib/uptime-tracker.ts`

```typescript
import { getDB } from './db';
import { logger } from './logger';

export interface UptimeMetric {
  timestamp: string;
  status: 'operational' | 'degraded' | 'outage';
  responseTime: number;
  queueDepth: number;
  activeIntegrations: number;
}

export interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  uptime: number; // percentage over last 90 days
  lastChecked: string;
}

/**
 * Record current system status snapshot
 */
export async function recordUptimeMetric(): Promise<void> {
  try {
    const db = await getDB();

    // Get current system metrics
    const queueDepth = db.prepare(
      "SELECT COUNT(*) as count FROM notification_queue WHERE status = 'pending'"
    ).get() as { count: number };

    const activeIntegrations = db.prepare(
      "SELECT COUNT(*) as count FROM integrations WHERE enabled = 1"
    ).get() as { count: number };

    // Determine status based on thresholds
    let status: UptimeMetric['status'] = 'operational';
    if (queueDepth.count > 1000) status = 'degraded';
    if (queueDepth.count > 5000) status = 'outage';

    const metric: UptimeMetric = {
      timestamp: new Date().toISOString(),
      status,
      responseTime: 0, // Will be measured by health check
      queueDepth: queueDepth.count,
      activeIntegrations: activeIntegrations.count
    };

    // Store in metrics cache
    const key = `uptime:${Date.now()}`;
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

    db.prepare(
      'INSERT INTO metrics_cache (key, value, expiresAt) VALUES (?, ?, ?)'
    ).run(key, JSON.stringify(metric), expiresAt);

    // Clean up old metrics (keep 90 days)
    db.prepare(
      "DELETE FROM metrics_cache WHERE key LIKE 'uptime:%' AND expiresAt < ?"
    ).run(new Date().toISOString());

    logger.info('Uptime metric recorded', { status, queueDepth: queueDepth.count });
  } catch (error) {
    logger.error('Failed to record uptime metric', { error });
  }
}

/**
 * Calculate uptime percentage for a service over last N days
 */
export async function calculateUptime(days: number = 90): Promise<number> {
  const db = await getDB();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const metrics = db.prepare(
    "SELECT value FROM metrics_cache WHERE key LIKE 'uptime:%' AND expiresAt > ? ORDER BY key DESC"
  ).all(since) as { value: string }[];

  if (metrics.length === 0) return 100; // No data = assume operational

  const operational = metrics.filter(m => {
    const metric = JSON.parse(m.value) as UptimeMetric;
    return metric.status === 'operational';
  });

  return (operational.length / metrics.length) * 100;
}

/**
 * Get current status of all services
 */
export async function getServicesStatus(): Promise<ServiceStatus[]> {
  const db = await getDB();

  // Database service
  const dbStatus = await checkDatabaseStatus();

  // Queue service
  const queueStatus = await checkQueueStatus();

  // Webhooks service
  const webhooksStatus = await checkWebhooksStatus();

  return [
    {
      name: 'Database',
      status: dbStatus.status,
      uptime: await calculateUptime(90),
      lastChecked: new Date().toISOString()
    },
    {
      name: 'Notification Queue',
      status: queueStatus.status,
      uptime: await calculateUptime(90),
      lastChecked: new Date().toISOString()
    },
    {
      name: 'Webhook Delivery',
      status: webhooksStatus.status,
      uptime: await calculateUptime(90),
      lastChecked: new Date().toISOString()
    }
  ];
}

async function checkDatabaseStatus(): Promise<{ status: ServiceStatus['status'] }> {
  try {
    const db = await getDB();
    const start = Date.now();
    db.prepare('SELECT 1').get();
    const duration = Date.now() - start;

    if (duration > 1000) return { status: 'degraded' };
    return { status: 'operational' };
  } catch {
    return { status: 'outage' };
  }
}

async function checkQueueStatus(): Promise<{ status: ServiceStatus['status'] }> {
  const db = await getDB();
  const queueDepth = db.prepare(
    "SELECT COUNT(*) as count FROM notification_queue WHERE status = 'pending'"
  ).get() as { count: number };

  if (queueDepth.count > 5000) return { status: 'outage' };
  if (queueDepth.count > 1000) return { status: 'degraded' };
  return { status: 'operational' };
}

async function checkWebhooksStatus(): Promise<{ status: ServiceStatus['status'] }> {
  const db = await getDB();

  // Check failure rate in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM notification_queue
    WHERE createdAt > ?
  `).get(oneHourAgo) as { total: number; failed: number };

  if (stats.total === 0) return { status: 'operational' };

  const failureRate = (stats.failed / stats.total) * 100;

  if (failureRate > 50) return { status: 'outage' };
  if (failureRate > 20) return { status: 'degraded' };
  return { status: 'operational' };
}
```

### Step 2: Create Public Status API Endpoint

**File**: `src/app/api/public/status/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getServicesStatus, calculateUptime } from '@/lib/uptime-tracker';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get current service statuses
    const services = await getServicesStatus();

    // Get overall system status
    const overallStatus = services.every(s => s.status === 'operational')
      ? 'operational'
      : services.some(s => s.status === 'outage')
      ? 'outage'
      : 'degraded';

    // Get uptime percentages
    const uptime90d = await calculateUptime(90);
    const uptime30d = await calculateUptime(30);
    const uptime7d = await calculateUptime(7);

    // Get recent incidents (from last 30 days)
    const db = await getDB();
    const incidents = db.prepare(`
      SELECT value FROM metrics_cache
      WHERE key LIKE 'uptime:%'
        AND json_extract(value, '$.status') != 'operational'
        AND expiresAt > datetime('now', '-30 days')
      ORDER BY key DESC
      LIMIT 10
    `).all() as { value: string }[];

    const response = {
      status: overallStatus,
      lastUpdated: new Date().toISOString(),
      uptime: {
        '7d': uptime7d,
        '30d': uptime30d,
        '90d': uptime90d
      },
      services,
      recentIncidents: incidents.map(i => JSON.parse(i.value))
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'Access-Control-Allow-Origin': '*' // Allow public access
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Public Status Page Component

**File**: `src/app/status/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle, Activity } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  uptime: number;
  lastChecked: string;
}

interface StatusData {
  status: 'operational' | 'degraded' | 'outage';
  lastUpdated: string;
  uptime: {
    '7d': number;
    '30d': number;
    '90d': number;
  };
  services: ServiceStatus[];
  recentIncidents: any[];
}

export default function StatusPage() {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/public/status');
      const data = await res.json();
      setStatusData(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = {
    operational: CheckCircle2,
    degraded: AlertCircle,
    outage: XCircle
  }[statusData?.status || 'operational'];

  const statusColor = {
    operational: 'text-green-500',
    degraded: 'text-yellow-500',
    outage: 'text-red-500'
  }[statusData?.status || 'operational'];

  const statusBadgeVariant = {
    operational: 'default',
    degraded: 'secondary',
    outage: 'destructive'
  }[statusData?.status || 'operational'] as 'default' | 'secondary' | 'destructive';

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">NCRelay Status</h1>
          </div>
          <p className="text-muted-foreground">
            Real-time status and uptime monitoring
          </p>
        </div>

        {/* Overall Status */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon className={`h-8 w-8 ${statusColor}`} />
                <div>
                  <CardTitle className="text-2xl">
                    {statusData?.status === 'operational' && 'All Systems Operational'}
                    {statusData?.status === 'degraded' && 'Partial System Outage'}
                    {statusData?.status === 'outage' && 'Major System Outage'}
                  </CardTitle>
                  <CardDescription>
                    Last updated: {statusData ? new Date(statusData.lastUpdated).toLocaleString() : '-'}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={statusBadgeVariant} className="text-sm px-3 py-1">
                {statusData?.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Uptime Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Uptime</CardTitle>
            <CardDescription>System availability over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-3xl font-bold text-primary">
                  {statusData?.uptime['7d'].toFixed(2)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">Last 7 days</div>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-3xl font-bold text-primary">
                  {statusData?.uptime['30d'].toFixed(2)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">Last 30 days</div>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-3xl font-bold text-primary">
                  {statusData?.uptime['90d'].toFixed(2)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">Last 90 days</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services Status */}
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>Individual component status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusData?.services.map((service) => {
              const ServiceIcon = {
                operational: CheckCircle2,
                degraded: AlertCircle,
                outage: XCircle
              }[service.status];

              const serviceColor = {
                operational: 'text-green-500',
                degraded: 'text-yellow-500',
                outage: 'text-red-500'
              }[service.status];

              return (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-4 bg-muted/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <ServiceIcon className={`h-5 w-5 ${serviceColor}`} />
                    <div>
                      <div className="font-medium">{service.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {service.uptime.toFixed(2)}% uptime
                      </div>
                    </div>
                  </div>
                  <Badge variant={service.status === 'operational' ? 'default' : 'secondary'}>
                    {service.status}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        {statusData?.recentIncidents && statusData.recentIncidents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusData.recentIncidents.map((incident, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <div className="font-medium">{incident.status} detected</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(incident.timestamp).toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Queue depth: {incident.queueDepth} | Response time: {incident.responseTime}ms
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Schedule Uptime Recording

**File**: `src/lib/scheduled-tasks.ts` (add to existing file or create new)

```typescript
import { recordUptimeMetric } from './uptime-tracker';
import { logger } from './logger';

/**
 * Start uptime tracking (record metrics every 5 minutes)
 */
export function startUptimeTracking(): void {
  // Record immediately on startup
  recordUptimeMetric();

  // Then every 5 minutes
  setInterval(() => {
    recordUptimeMetric();
  }, 5 * 60 * 1000);

  logger.info('Uptime tracking started (5 minute intervals)');
}
```

**Update**: `server.js` to start tracking

```javascript
import { startUptimeTracking } from './src/lib/scheduled-tasks.js';

// After migrations
startUptimeTracking();
```

---

## Feature 8: Interactive API Documentation

### Overview
Auto-generated OpenAPI/Swagger documentation with interactive testing interface. Makes it easy for developers to understand and test your API.

**Effort Estimate**: 8-10 hours

### Step 1: Install OpenAPI Dependencies

```bash
npm install swagger-ui-react swagger-jsdoc
npm install -D @types/swagger-ui-react
```

### Step 2: Create OpenAPI Specification Generator

**File**: `src/lib/openapi-spec.ts`

```typescript
import { getEnv } from './env';

export function generateOpenAPISpec() {
  const env = getEnv();
  const baseUrl = env.NODE_ENV === 'production'
    ? `https://${env.BASE_URL || 'localhost'}`
    : `http://localhost:${env.PORT}`;

  return {
    openapi: '3.0.0',
    info: {
      title: 'NCRelay API',
      version: '1.0.0',
      description: 'Notification relay service for forwarding webhooks to multiple platforms',
      contact: {
        name: 'API Support',
        email: env.INITIAL_ADMIN_EMAIL
      }
    },
    servers: [
      {
        url: baseUrl,
        description: env.NODE_ENV === 'production' ? 'Production' : 'Development'
      }
    ],
    tags: [
      { name: 'Webhooks', description: 'Webhook ingestion endpoints' },
      { name: 'Endpoints', description: 'API endpoint management' },
      { name: 'Integrations', description: 'Integration management' },
      { name: 'Authentication', description: 'User authentication' },
      { name: 'Monitoring', description: 'System monitoring and health' }
    ],
    paths: {
      '/api/webhook/{slug}': {
        post: {
          tags: ['Webhooks'],
          summary: 'Receive webhook payload',
          description: 'Accepts webhook data and forwards to configured integrations',
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              description: 'API endpoint slug',
              schema: { type: 'string' }
            },
            {
              name: 'X-API-Key',
              in: 'header',
              required: false,
              description: 'API key if endpoint requires authentication',
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
                example: {
                  event: 'user.created',
                  data: {
                    userId: '123',
                    email: 'user@example.com'
                  }
                }
              },
              'application/xml': {
                schema: { type: 'string' },
                example: '<?xml version="1.0"?><event><type>user.created</type></event>'
              }
            }
          },
          responses: {
            '200': {
              description: 'Webhook received successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      requestId: { type: 'string' }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'API key missing or invalid'
            },
            '404': {
              description: 'Endpoint not found'
            },
            '500': {
              description: 'Internal server error'
            }
          },
          security: [
            { ApiKeyAuth: [] },
            {} // Also allow no auth if endpoint doesn't require it
          ]
        }
      },
      '/api/endpoints': {
        get: {
          tags: ['Endpoints'],
          summary: 'List all API endpoints',
          description: 'Get all configured webhook endpoints',
          responses: {
            '200': {
              description: 'List of endpoints',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        description: { type: 'string' },
                        enabled: { type: 'boolean' },
                        requireApiKey: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          },
          security: [{ BearerAuth: [] }]
        },
        post: {
          tags: ['Endpoints'],
          summary: 'Create new endpoint',
          description: 'Create a new webhook endpoint',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'slug'],
                  properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string' },
                    requireApiKey: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Endpoint created successfully'
            },
            '400': {
              description: 'Invalid input'
            },
            '409': {
              description: 'Slug already exists'
            }
          },
          security: [{ BearerAuth: [] }]
        }
      },
      '/api/public/status': {
        get: {
          tags: ['Monitoring'],
          summary: 'Get system status',
          description: 'Public endpoint showing system health and uptime',
          responses: {
            '200': {
              description: 'System status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        enum: ['operational', 'degraded', 'outage']
                      },
                      uptime: {
                        type: 'object',
                        properties: {
                          '7d': { type: 'number' },
                          '30d': { type: 'number' },
                          '90d': { type: 'number' }
                        }
                      },
                      services: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            status: { type: 'string' },
                            uptime: { type: 'number' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/health': {
        get: {
          tags: ['Monitoring'],
          summary: 'Health check endpoint',
          description: 'Returns detailed health status of all system components',
          responses: {
            '200': {
              description: 'System is healthy'
            },
            '503': {
              description: 'System is degraded or unhealthy'
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for webhook endpoint authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  };
}
```

### Step 3: Create API Documentation Endpoint

**File**: `src/app/api/docs/openapi.json/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/openapi-spec';

export const dynamic = 'force-dynamic';

export async function GET() {
  const spec = generateOpenAPISpec();

  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  });
}
```

### Step 4: Create Swagger UI Page

**File**: `src/app/docs/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    fetch('/api/docs/openapi.json')
      .then(res => res.json())
      .then(data => setSpec(data))
      .catch(err => console.error('Failed to load API spec:', err));
  }, []);

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SwaggerUI
        spec={spec}
        docExpansion="list"
        defaultModelsExpandDepth={1}
        displayRequestDuration={true}
        filter={true}
      />
    </div>
  );
}
```

### Step 5: Add Navigation Links

**Update**: `src/components/nav.tsx` (or your main navigation)

Add links to the new pages:

```typescript
<nav>
  {/* ... existing links ... */}
  <a href="/docs" className="nav-link">
    API Docs
  </a>
  <a href="/status" target="_blank" className="nav-link">
    Status
  </a>
</nav>
```

---

## Testing the Public Features

### Test Public Status Page

1. Start the uptime tracking:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:9005/status`
   - Should show all systems operational
   - Displays uptime percentages
   - Lists individual service statuses

3. Test the API endpoint directly:
   ```bash
   curl http://localhost:9005/api/public/status
   ```

### Test API Documentation

1. Visit `http://localhost:9005/docs`
   - Should load Swagger UI interface
   - All endpoints should be listed
   - Try the "Try it out" feature on `/api/public/status`

2. Test authentication flows:
   - Click "Authorize" button
   - Enter JWT token from login
   - Test protected endpoints

### Monitoring Integration

Both features integrate with your existing monitoring:

```typescript
// In your monitoring dashboard
import { getServicesStatus } from '@/lib/uptime-tracker';

// Display current status
const services = await getServicesStatus();
```

---

## Next Steps

1. **Customize Status Page**:
   - Add your branding
   - Configure incident thresholds
   - Set up automated incident posting

2. **Enhance API Documentation**:
   - Add more detailed examples
   - Document error codes
   - Add code samples in multiple languages

3. **Set Up Monitoring**:
   - Configure uptime checks from external services
   - Set up alerts for status changes
   - Integrate with alerting system (Feature 16)

