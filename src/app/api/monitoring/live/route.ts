import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { requirePermission } from '@/lib/permission-middleware';

export async function GET() {
  // Check permission to read logs/analytics (tenant admins and system admins)
  const permission = await requirePermission('logs', 'read');
  
  if (!permission.allowed || !permission.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const db = await getDB();
    const tenantId = permission.tenantId;

    // Queue Statistics (filtered by tenant if not system admin)
    const queueStatsQuery = tenantId
      ? `SELECT status, COUNT(*) as count, AVG(retryCount) as avgRetries
         FROM notification_queue nq
         JOIN integrations i ON nq.integrationId = i.id
         WHERE i.tenantId = ?
         GROUP BY status`
      : `SELECT status, COUNT(*) as count, AVG(retryCount) as avgRetries
         FROM notification_queue
         GROUP BY status`;
    
    const queueStats = (tenantId
      ? db.prepare(queueStatsQuery).all(tenantId)
      : db.prepare(queueStatsQuery).all()) as Array<{ status: string; count: number; avgRetries: number }>;

    // Recent Activity (last 100 items, excluding GET requests that don't trigger integrations, filtered by tenant)
    const recentActivityQuery = tenantId
      ? `SELECT r.id, r.timestamp, r.incomingRequestMethod as method, r.apiEndpointId, r.apiEndpointName, r.processingOverallStatus as status
         FROM request_logs r
         JOIN api_endpoints e ON r.apiEndpointId = e.id
         WHERE e.tenantId = ? AND NOT (r.incomingRequestMethod = 'GET' AND r.processingOverallStatus = 'no_integrations_triggered')
         ORDER BY r.timestamp DESC
         LIMIT 100`
      : `SELECT r.id, r.timestamp, r.incomingRequestMethod as method, r.apiEndpointId, r.apiEndpointName, r.processingOverallStatus as status
         FROM request_logs r
         WHERE NOT (r.incomingRequestMethod = 'GET' AND r.processingOverallStatus = 'no_integrations_triggered')
         ORDER BY r.timestamp DESC
         LIMIT 100`;
    
    const recentActivity = (tenantId
      ? db.prepare(recentActivityQuery).all(tenantId)
      : db.prepare(recentActivityQuery).all()) as Array<{
      id: string;
      timestamp: string;
      method: string;
      apiEndpointId: string;
      apiEndpointName: string;
      status: string;
    }>;

    // Integration Health (last hour, filtered by tenant)
    const integrationHealthQuery = tenantId
      ? `SELECT i.id, i.name, i.platform, i.enabled,
         COUNT(CASE WHEN nq.status = 'failed' THEN 1 END) as failedCount,
         COUNT(CASE WHEN nq.status = 'completed' THEN 1 END) as successCount,
         COUNT(*) as totalCount
         FROM integrations i
         LEFT JOIN notification_queue nq ON nq.integrationId = i.id
           AND nq.createdAt > datetime('now', '-1 hour')
         WHERE i.tenantId = ?
         GROUP BY i.id, i.name, i.platform, i.enabled
         ORDER BY totalCount DESC`
      : `SELECT i.id, i.name, i.platform, i.enabled,
         COUNT(CASE WHEN nq.status = 'failed' THEN 1 END) as failedCount,
         COUNT(CASE WHEN nq.status = 'completed' THEN 1 END) as successCount,
         COUNT(*) as totalCount
         FROM integrations i
         LEFT JOIN notification_queue nq ON nq.integrationId = i.id
           AND nq.createdAt > datetime('now', '-1 hour')
         GROUP BY i.id, i.name, i.platform, i.enabled
         ORDER BY totalCount DESC`;
    
    const integrationHealth = (tenantId
      ? db.prepare(integrationHealthQuery).all(tenantId)
      : db.prepare(integrationHealthQuery).all()) as Array<{
      id: string;
      name: string;
      platform: string;
      enabled: number;
      failedCount: number;
      successCount: number;
      totalCount: number;
    }>;

    // Active Endpoints Count (filtered by tenant)
    const activeEndpointsQuery = tenantId
      ? `SELECT COUNT(*) as count FROM api_endpoints WHERE enabled = 1 AND tenantId = ?`
      : `SELECT COUNT(*) as count FROM api_endpoints WHERE enabled = 1`;
    
    const activeEndpoints = (tenantId
      ? db.prepare(activeEndpointsQuery).get(tenantId)
      : db.prepare(activeEndpointsQuery).get()) as { count: number };

    // Total Integrations Count (filtered by tenant)
    const totalIntegrationsQuery = tenantId
      ? `SELECT COUNT(*) as count FROM integrations WHERE enabled = 1 AND tenantId = ?`
      : `SELECT COUNT(*) as count FROM integrations WHERE enabled = 1`;
    
    const totalIntegrations = (tenantId
      ? db.prepare(totalIntegrationsQuery).get(tenantId)
      : db.prepare(totalIntegrationsQuery).get()) as { count: number };

    // System Metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    };

    // Calculate success rate from recent activity (processingOverallStatus)
    // Only count POST requests that actually attempted to deliver notifications
    const relevantRequests = recentActivity.filter(a => 
      a.method === 'POST' && 
      a.status !== 'no_integrations_triggered'
    );
    const successCount = relevantRequests.filter(a => 
      a.status === 'success' || a.status === 'partial_failure'
    ).length;
    const totalRequests = relevantRequests.length;
    const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

    // Average response time is not stored, so we'll calculate based on request count
    const avgResponseTime = 0; // Not available in current schema

    return NextResponse.json({
      queueStats,
      recentActivity,
      integrationHealth: integrationHealth.map(i => ({
        ...i,
        enabled: !!i.enabled
      })),
      overview: {
        activeEndpoints: activeEndpoints.count,
        activeIntegrations: totalIntegrations.count,
        successRate: Math.round(successRate * 10) / 10,
        avgResponseTime: Math.round(avgResponseTime),
        queueDepth: queueStats.reduce((sum, s) => sum + (s.status === 'pending' ? s.count : 0), 0)
      },
      systemMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching live monitoring data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch monitoring data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
