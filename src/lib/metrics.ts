import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// HTTP request metrics
export const httpRequestsTotal = new Counter({
  name: 'ncrelay_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

export const httpRequestDuration = new Histogram({
  name: 'ncrelay_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// Queue processing metrics
export const queueProcessingDuration = new Histogram({
  name: 'ncrelay_queue_processing_duration_seconds',
  help: 'Queue processing duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

export const queueSize = new Gauge({
  name: 'ncrelay_queue_size',
  help: 'Current queue size by status',
  labelNames: ['status'],
  registers: [register]
});

export const queueProcessedTotal = new Counter({
  name: 'ncrelay_queue_processed_total',
  help: 'Total notifications processed from queue',
  labelNames: ['status'],
  registers: [register]
});

// Webhook delivery metrics
export const webhookDeliveryTotal = new Counter({
  name: 'ncrelay_webhook_delivery_total',
  help: 'Total webhook deliveries',
  labelNames: ['platform', 'status'],
  registers: [register]
});

export const webhookDeliveryDuration = new Histogram({
  name: 'ncrelay_webhook_delivery_duration_seconds',
  help: 'Webhook delivery duration in seconds',
  labelNames: ['platform'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

// Integration metrics
export const activeIntegrations = new Gauge({
  name: 'ncrelay_active_integrations',
  help: 'Number of active integrations',
  labelNames: ['platform'],
  registers: [register]
});

// API endpoint metrics
export const activeEndpoints = new Gauge({
  name: 'ncrelay_active_endpoints',
  help: 'Number of active API endpoints',
  registers: [register]
});

// Database metrics
export const databaseQueryDuration = new Histogram({
  name: 'ncrelay_database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

// Authentication metrics
export const authenticationAttempts = new Counter({
  name: 'ncrelay_authentication_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['status'],
  registers: [register]
});

// Helper function to time async operations
export async function timeAsync<T>(
  histogram: Histogram,
  labels: Record<string, string | number>,
  fn: () => Promise<T>
): Promise<T> {
  const end = histogram.startTimer(labels);
  try {
    return await fn();
  } finally {
    end();
  }
}
