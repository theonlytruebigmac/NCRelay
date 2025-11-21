# NCRelay Application - Code Review & Recommendations

## Executive Summary

NCRelay is a well-architected notification relay service with comprehensive security features, excellent documentation, and modern development practices. This review identifies opportunities for improvement across security, scalability, testing, and operational excellence.

**Overall Assessment**: Production-ready with room for enhancement in multi-instance deployment, testing coverage, and observability.

---

## 1. Critical Security Improvements

### 1.1 Remove Hardcoded Security Fallbacks

**Priority: CRITICAL**

**Issue**: `src/lib/auth.ts:5`
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
```

This fallback value is a critical security vulnerability. If `JWT_SECRET` is not set, the application will use a known, weak secret.

**Recommendation**:
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET environment variable must be set and at least 32 characters long');
}
```

**Why**: Failing fast on startup is better than running with insecure defaults.

### 1.2 Validate Environment Variables on Startup

**Priority: HIGH**

**Issue**: Missing comprehensive environment variable validation.

**Recommendation**: Create `src/lib/env.ts`:
```typescript
import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64),
  PORT: z.coerce.number().default(9004),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).optional(),
  // ... other env vars
});

export const env = envSchema.parse(process.env);
```

Call this validation in `src/server.ts` before initializing the app.

**Benefits**:
- Fail fast with clear error messages
- Type-safe environment variables throughout the app
- Self-documenting configuration requirements

### 1.3 Rate Limiting for Password Reset

**Priority: MEDIUM**

**Issue**: No rate limiting on password reset token creation in `src/lib/db.ts:212`.

**Recommendation**: Add rate limiting to prevent abuse:
```typescript
// Track reset attempts per email
const resetAttempts = new Map<string, { count: number, resetTime: number }>();

export async function createPasswordResetToken(userId: string): Promise<string> {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  // Check rate limit (e.g., 3 attempts per hour)
  const now = Date.now();
  const attempts = resetAttempts.get(user.email);
  if (attempts && attempts.count >= 3 && now < attempts.resetTime) {
    throw new Error('Too many password reset requests. Please try again later.');
  }

  // ... existing code
}
```

### 1.4 Add Multi-Factor Authentication (MFA) Support

**Priority: LOW**

**Issue**: No MFA/2FA support for admin accounts.

**Recommendation**: Consider adding TOTP-based MFA for admin users using libraries like `otplib` or `speakeasy`.

### 1.5 Security Headers

**Priority: MEDIUM**

**Issue**: No security headers configured.

**Recommendation**: Add security headers in `next.config.ts`:
```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ];
}
```

---

## 2. Logging & Error Handling

### 2.1 Implement Structured Logging

**Priority: HIGH**

**Issue**: 337 instances of `console.log/warn/error` throughout the codebase. Console logging is not suitable for production.

**Recommendation**: Implement structured logging with Winston or Pino:

```bash
npm install pino pino-pretty
```

Create `src/lib/logger.ts`:
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined,
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

Replace all `console.log` with:
```typescript
import { logger } from '@/lib/logger';
logger.info({ endpoint: endpointName }, 'Processing webhook');
logger.error({ error, userId }, 'Failed to create user');
```

**Benefits**:
- Searchable, structured logs
- Automatic log rotation
- Integration with log aggregation services (Datadog, CloudWatch, etc.)
- Performance improvements

### 2.2 Centralized Error Handling

**Priority: MEDIUM**

**Issue**: Error handling is scattered throughout the codebase.

**Recommendation**: Create custom error classes:

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, true, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, true);
  }
}
```

Use in API routes:
```typescript
if (!endpointConfig) {
  throw new NotFoundError('API Endpoint');
}
```

### 2.3 Sanitize Error Messages

**Priority: MEDIUM**

**Issue**: Error messages sometimes expose implementation details (e.g., database paths, stack traces).

**Recommendation**: Never return raw error messages to clients in production:

```typescript
const errorResponse = process.env.NODE_ENV === 'production'
  ? { error: 'Internal server error' }
  : { error: errorMessage, stack: error.stack };
```

---

## 3. Testing Improvements

### 3.1 Expand Unit Test Coverage

**Priority: HIGH**

**Issue**: Only 4 test files exist. Critical paths like notification queue, authentication, and encryption are not tested.

**Recommendation**: Add tests for:

**Critical Path Tests**:
- `src/lib/notification-queue.ts` - Queue processing, retries, failures
- `src/lib/auth.ts` - Token generation, validation, expiry
- `src/lib/crypto.ts` - Encryption/decryption round-trips
- `src/lib/db.ts` - All CRUD operations
- `src/lib/field-filter-processor.ts` - Field extraction logic

**Target Coverage**: Aim for 80%+ coverage on critical business logic.

### 3.2 Add Integration Tests

**Priority: MEDIUM**

**Issue**: No integration tests for API endpoints.

**Recommendation**: Add integration tests using Next.js testing utilities:

```typescript
// src/__tests__/integration/custom-endpoint.test.ts
import { POST } from '@/app/api/custom/[endpointName]/route';

describe('/api/custom/[endpointName]', () => {
  it('should process valid XML and queue notifications', async () => {
    const mockRequest = new Request('http://localhost/api/custom/test', {
      method: 'POST',
      body: '<notification>test</notification>',
      headers: { 'content-type': 'application/xml' }
    });

    const response = await POST(mockRequest, {
      params: Promise.resolve({ endpointName: 'test' })
    });

    expect(response.status).toBe(200);
    // ... assertions
  });
});
```

### 3.3 Add End-to-End Tests

**Priority: LOW**

**Recommendation**: Consider Playwright or Cypress for critical user flows:
- Admin login
- Create integration
- Create endpoint
- View logs
- Queue management

---

## 4. Database & Performance

### 4.1 Add Database Indexes

**Priority: HIGH**

**Issue**: No indexes mentioned in migrations. Queries may be slow as data grows.

**Recommendation**: Create a new migration to add indexes:

```typescript
// src/migrations/017-add-indexes.ts
export const up = (db: Database) => {
  db.exec(`
    -- Improve request log queries
    CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_request_logs_api_endpoint_id ON request_logs(apiEndpointId);

    -- Improve queue queries
    CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
    CREATE INDEX IF NOT EXISTS idx_notification_queue_next_retry ON notification_queue(nextRetryAt);
    CREATE INDEX IF NOT EXISTS idx_notification_queue_created_at ON notification_queue(createdAt);

    -- Improve integration queries
    CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled);

    -- Improve user queries
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- Improve password reset token queries
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expiresAt);
  `);
};
```

### 4.2 Optimize Dashboard Stats Query

**Priority: MEDIUM**

**Issue**: `getDashboardStats()` in `src/lib/db.ts:562` decrypts all logs, which is expensive.

**Recommendation**: Aggregate data during log insertion instead:

```typescript
// Add a new table to track daily statistics
CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  total_requests INTEGER DEFAULT 0,
  successful_relays INTEGER DEFAULT 0,
  failed_relays INTEGER DEFAULT 0
);

// Update stats on each request
export async function updateDailyStats(success: number, failed: number) {
  const today = new Date().toISOString().split('T')[0];
  const db = await getDB();
  db.prepare(`
    INSERT INTO daily_stats (date, total_requests, successful_relays, failed_relays)
    VALUES (?, 1, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_requests = total_requests + 1,
      successful_relays = successful_relays + excluded.successful_relays,
      failed_relays = failed_relays + excluded.failed_relays
  `).run(today, success, failed);
}
```

### 4.3 Make MAX_LOG_ENTRIES Configurable

**Priority: LOW**

**Issue**: `MAX_LOG_ENTRIES` is hardcoded to 50 in `src/lib/db.ts:421`.

**Recommendation**: Move to environment variable:
```typescript
const MAX_LOG_ENTRIES = parseInt(process.env.MAX_LOG_ENTRIES || '1000');
```

---

## 5. Scalability & Architecture

### 5.1 Multi-Instance Deployment Support

**Priority: HIGH**

**Issue**: Current architecture assumes single-instance deployment:
- In-memory rate limiting (`src/middleware.ts:5`)
- Scheduled tasks use `setInterval` (`src/lib/scheduled-tasks.ts`)
- No distributed locking for queue processing

**Recommendation**: For multi-instance deployment, implement:

**Option A: Redis-based solutions**
```bash
npm install ioredis
```

```typescript
// src/lib/redis.ts
import Redis from 'ioredis';
export const redis = new Redis(process.env.REDIS_URL);

// Rate limiting
import { RateLimiterRedis } from 'rate-limiter-flexible';
export const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  points: 100,
  duration: 60,
});

// Distributed locking
import Redlock from 'redlock';
export const redlock = new Redlock([redis]);
```

**Option B: PostgreSQL for better multi-instance support**
Consider migrating from SQLite to PostgreSQL for production deployments with multiple instances.

### 5.2 Leader Election for Scheduled Tasks

**Priority: MEDIUM**

**Issue**: All instances will run scheduled tasks, causing duplicate processing.

**Recommendation**: Implement leader election:

```typescript
// Only run scheduled tasks on leader instance
import { redis } from './redis';

async function tryAcquireLock() {
  const lock = await redis.set('ncrelay:leader', process.pid, 'EX', 30, 'NX');
  return lock === 'OK';
}

export async function initScheduledTasks() {
  const isLeader = await tryAcquireLock();
  if (!isLeader) {
    logger.info('Not leader, skipping scheduled task initialization');
    return;
  }

  // ... existing task initialization

  // Renew leadership every 20 seconds
  setInterval(tryAcquireLock, 20000);
}
```

### 5.3 Queue Processing Distributed Lock

**Priority: HIGH**

**Issue**: Multiple instances could process the same queued notification.

**Recommendation**: Add row-level locking or use `SELECT FOR UPDATE`:

```typescript
export async function getQueuedNotificationsByStatus(status: QueueStatus, limit = 100): Promise<QueuedNotification[]> {
  const db = await getDB();

  // SQLite doesn't support SELECT FOR UPDATE, so use a transaction with immediate locking
  const transaction = db.transaction(() => {
    const stmt = db.prepare(`
      UPDATE notification_queue
      SET status = 'processing'
      WHERE id IN (
        SELECT id FROM notification_queue
        WHERE status = ?
        AND (nextRetryAt IS NULL OR nextRetryAt <= ?)
        ORDER BY priority DESC, createdAt ASC
        LIMIT ?
      )
      RETURNING *
    `);
    return stmt.all(status, new Date().toISOString(), limit) as QueuedNotification[];
  });

  return transaction();
}
```

**Better solution**: For multi-instance, use PostgreSQL or a dedicated message queue (BullMQ, RabbitMQ).

---

## 6. Code Quality & Maintainability

### 6.1 Refactor Large Route Handler

**Priority: MEDIUM**

**Issue**: `src/app/api/custom/[endpointName]/route.ts` is 785 lines long.

**Recommendation**: Extract platform-specific formatters into separate files:

```
src/lib/formatters/
├── index.ts          # Export all formatters
├── teams.ts          # Teams Adaptive Card formatting
├── discord.ts        # Discord embed formatting
├── slack.ts          # Slack formatting (already exists)
└── generic.ts        # Generic webhook formatting
```

Extract webhook processing logic:
```typescript
// src/lib/webhook-processor.ts
export async function processWebhook(
  xmlPayload: string,
  integration: Integration,
  endpointConfig: ApiEndpointConfig
): Promise<ProcessingResult> {
  // All the processing logic from route.ts
}
```

This makes the code more testable and maintainable.

### 6.2 Fix Type Safety Issues

**Priority: MEDIUM**

**Issue**: Use of `any` type in several places (e.g., `src/lib/notification-queue.ts:96`).

**Recommendation**: Replace `any[]` with proper types:

```typescript
const updateFields: string[] = ['updatedAt = ?'];
const params: (string | number | null)[] = [now];
```

Enable strict TypeScript checking:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 6.3 Complete TODO Items

**Priority: LOW**

**Issue**: TODO found in `src/lib/scheduled-tasks.ts:42` regarding backup cleanup.

**Recommendation**: Implement backup retention:

```typescript
async function cleanupOldBackups(retentionDays: number) {
  const backupDir = path.join(process.cwd(), 'backups');
  const files = await fs.readdir(backupDir);
  const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stats = await fs.stat(filePath);
    if (stats.mtimeMs < cutoffDate) {
      await fs.unlink(filePath);
      logger.info({ file }, 'Deleted old backup');
    }
  }
}
```

---

## 7. Monitoring & Observability

### 7.1 Add Application Metrics

**Priority: HIGH**

**Issue**: No metrics collection for monitoring application health.

**Recommendation**: Implement Prometheus-compatible metrics:

```bash
npm install prom-client
```

```typescript
// src/lib/metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

export const httpRequestsTotal = new Counter({
  name: 'ncrelay_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

export const queueProcessingDuration = new Histogram({
  name: 'ncrelay_queue_processing_duration_seconds',
  help: 'Queue processing duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

export const queueSize = new Gauge({
  name: 'ncrelay_queue_size',
  help: 'Current queue size',
  labelNames: ['status'],
  registers: [register]
});

export const webhookDeliveryTotal = new Counter({
  name: 'ncrelay_webhook_delivery_total',
  help: 'Total webhook deliveries',
  labelNames: ['platform', 'status'],
  registers: [register]
});
```

Add metrics endpoint:
```typescript
// src/app/api/metrics/route.ts
import { register } from '@/lib/metrics';

export async function GET() {
  return new Response(await register.metrics(), {
    headers: { 'Content-Type': register.contentType }
  });
}
```

### 7.2 Enhanced Health Check

**Priority: MEDIUM**

**Issue**: Current health check in `src/app/api/health/route.ts` only returns OK.

**Recommendation**: Add comprehensive health checks:

```typescript
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      queueProcessing: await checkQueueProcessing(),
      diskSpace: await checkDiskSpace()
    }
  };

  const isHealthy = Object.values(health.checks).every(c => c.status === 'ok');

  return NextResponse.json(health, {
    status: isHealthy ? 200 : 503
  });
}
```

### 7.3 Error Monitoring Integration

**Priority: MEDIUM**

**Recommendation**: Integrate with error monitoring service (Sentry):

```bash
npm install @sentry/nextjs
```

```typescript
// src/lib/error-monitoring.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Sanitize sensitive data
    if (event.request?.headers) {
      delete event.request.headers.authorization;
    }
    return event;
  }
});
```

---

## 8. Documentation Improvements

### 8.1 Add API Documentation

**Priority: MEDIUM**

**Recommendation**: Generate OpenAPI/Swagger documentation:

```bash
npm install swagger-jsdoc swagger-ui-react
```

Add JSDoc comments to API routes:
```typescript
/**
 * @swagger
 * /api/custom/{endpointName}:
 *   post:
 *     summary: Process incoming webhook notification
 *     parameters:
 *       - in: path
 *         name: endpointName
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/xml:
 *           schema:
 *             type: string
 *     responses:
 *       200:
 *         description: Notification processed successfully
 */
```

### 8.2 Architecture Decision Records (ADRs)

**Priority: LOW**

**Recommendation**: Document key architectural decisions:

```
docs/adr/
├── 001-use-sqlite-for-storage.md
├── 002-notification-queue-design.md
├── 003-encryption-strategy.md
└── 004-authentication-approach.md
```

---

## 9. DevOps & Deployment

### 9.1 Database Migration Rollback Strategy

**Priority: MEDIUM**

**Issue**: No rollback mechanism for migrations.

**Recommendation**: Implement `down` migrations:

```typescript
// src/migrations/017-example.ts
export const up = (db: Database) => {
  db.exec(`CREATE TABLE example (...)`);
};

export const down = (db: Database) => {
  db.exec(`DROP TABLE example`);
};
```

Add rollback command:
```typescript
// scripts/rollback-migration.ts
export async function rollbackMigration() {
  const lastMigration = await getLastAppliedMigration();
  if (lastMigration.down) {
    lastMigration.down(db);
    await removeMigrationRecord(lastMigration.id);
  }
}
```

### 9.2 Disaster Recovery Documentation

**Priority: MEDIUM**

**Recommendation**: Create `docs/DISASTER_RECOVERY.md`:

- Database backup procedures
- Restoration steps
- RTO/RPO targets
- Incident response runbook
- Contact information

### 9.3 Graceful Shutdown

**Priority: MEDIUM**

**Issue**: Application may not cleanly shut down scheduled tasks.

**Recommendation**: Add graceful shutdown in `server.js`:

```javascript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');

  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Stop scheduled tasks
  stopScheduledTasks();

  // Wait for in-flight queue processing
  await waitForQueueCompletion();

  // Close database connections
  db.close();

  process.exit(0);
});
```

---

## 10. Configuration & Environment

### 10.1 Config File Support

**Priority: LOW**

**Recommendation**: Support config files in addition to environment variables:

```typescript
// src/lib/config.ts
import { cosmiconfigSync } from 'cosmiconfig';

const explorer = cosmiconfigSync('ncrelay');
const configFile = explorer.search();

export const config = {
  ...configFile?.config,
  ...process.env, // Environment variables override config file
};
```

Supports `.ncrelayrc.json`, `.ncrelayrc.yml`, etc.

---

## Implementation Priority Matrix

| Priority | Category | Item | Estimated Effort |
|----------|----------|------|------------------|
| **P0 (Critical)** | Security | Remove JWT_SECRET fallback | 30 min |
| **P0** | Security | Validate environment variables | 2 hours |
| **P1 (High)** | Database | Add database indexes | 1 hour |
| **P1** | Logging | Implement structured logging | 4 hours |
| **P1** | Scalability | Distributed queue locking | 4 hours |
| **P1** | Testing | Add unit tests for critical paths | 8 hours |
| **P1** | Monitoring | Add application metrics | 4 hours |
| **P2 (Medium)** | Security | Rate limiting for password reset | 2 hours |
| **P2** | Security | Add security headers | 1 hour |
| **P2** | Performance | Optimize dashboard stats | 3 hours |
| **P2** | Code Quality | Refactor large route handler | 4 hours |
| **P2** | Monitoring | Enhanced health checks | 2 hours |
| **P2** | Testing | Add integration tests | 6 hours |
| **P3 (Low)** | Testing | Add E2E tests | 8 hours |
| **P3** | Documentation | OpenAPI documentation | 4 hours |
| **P3** | Configuration | Config file support | 2 hours |

---

## Conclusion

NCRelay is a robust and well-designed application. The recommendations above will enhance its security posture, scalability, testability, and operational excellence.

**Recommended Phase 1** (next sprint):
1. Remove security fallbacks (P0)
2. Environment variable validation (P0)
3. Database indexes (P1)
4. Structured logging (P1)

**Recommended Phase 2** (following sprint):
5. Unit test coverage (P1)
6. Application metrics (P1)
7. Security headers (P2)
8. Distributed queue locking (P1)

**Phase 3+** (ongoing):
- Integration tests
- Performance optimizations
- Enhanced monitoring
- Documentation improvements

The application is production-ready today, and these improvements will make it enterprise-grade and suitable for high-scale deployments.
