import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import * as fs from 'fs/promises';
import * as path from 'path';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  message?: string;
  details?: Record<string, unknown>;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    const db = await getDB();
    const start = Date.now();
    const result = db.prepare("SELECT 1 as test").get();
    const duration = Date.now() - start;

    if (!result) {
      return { status: 'error', message: 'Database query returned no results' };
    }

    return {
      status: duration > 100 ? 'degraded' : 'ok',
      details: { responseTime: `${duration}ms` }
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database check failed'
    };
  }
}

async function checkQueueProcessing(): Promise<HealthCheck> {
  try {
    const db = await getDB();
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM notification_queue
    `);
    const stats = stmt.get() as { total: number; pending: number; processing: number; failed: number };

    // Warn if too many pending or failed items
    const status = (stats.pending > 1000 || stats.failed > 100) ? 'degraded' : 'ok';

    return {
      status,
      details: stats
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Queue check failed'
    };
  }
}

async function checkDiskSpace(): Promise<HealthCheck> {
  try {
    const dbPath = process.env.NODE_ENV === 'production' ? '/data/app.db' : path.join(process.cwd(), 'app.db');
    const stats = await fs.stat(dbPath);
    const sizeInMB = Math.round(stats.size / (1024 * 1024));

    // Warn if database is getting large (> 1GB)
    const status = sizeInMB > 1024 ? 'degraded' : 'ok';

    return {
      status,
      details: { databaseSize: `${sizeInMB}MB` }
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Disk check failed'
    };
  }
}

export async function GET(_request: NextRequest) {
  // Skip health check during build
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { status: "ok", message: "Build phase - health check skipped" },
      { status: 200 }
    );
  }

  const [databaseCheck, queueCheck, diskCheck] = await Promise.all([
    checkDatabase(),
    checkQueueProcessing(),
    checkDiskSpace()
  ]);

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: databaseCheck,
      queueProcessing: queueCheck,
      diskSpace: diskCheck
    }
  };

  // Determine overall health status
  const hasError = Object.values(health.checks).some(c => c.status === 'error');
  const hasDegraded = Object.values(health.checks).some(c => c.status === 'degraded');

  if (hasError) {
    health.status = 'unhealthy';
  } else if (hasDegraded) {
    health.status = 'degraded';
  }

  const statusCode = hasError ? 503 : 200;

  return NextResponse.json(health, { status: statusCode });
}
