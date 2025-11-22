import { z } from 'zod';

const envSchema = z.object({
  // Core application settings
  PORT: z.coerce.number().default(9004),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Security settings
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters long'),

  // Initial admin user configuration (required for first setup)
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).optional(),
  INITIAL_ADMIN_NAME: z.string().optional(),

  // Optional SMTP configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.string().transform(val => val === 'true').optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().optional(),

  // Optional frontend URL
  FRONTEND_URL: z.string().url().optional(),

  // Optional logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Optional rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // Notification queue settings
  QUEUE_PROCESSING_INTERVAL: z.coerce.number().default(30000),
  DEFAULT_MAX_RETRIES: z.coerce.number().default(3),
  DEFAULT_RETRY_DELAY: z.coerce.number().default(300000),

  // Database configuration
  DB_TYPE: z.enum(['sqlite']).default('sqlite'),

  // Timezone
  TZ: z.string().optional(),

  // Next.js telemetry
  NEXT_TELEMETRY_DISABLED: z.string().optional(),

  // Optional max log entries
  MAX_LOG_ENTRIES: z.coerce.number().default(1000),
});

let cachedEnv: z.infer<typeof envSchema>;

export function validateEnv() {
  try {
    cachedEnv = envSchema.parse(process.env);
    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(
        (err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(
        `Environment variable validation failed:\n${errorMessages.join('\n')}`
      );
    }
    throw error;
  }
}

export function getEnv() {
  if (!cachedEnv) {
    throw new Error('Environment variables not validated. Call validateEnv() first.');
  }
  return cachedEnv;
}
