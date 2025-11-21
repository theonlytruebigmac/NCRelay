import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: process.env.NODE_ENV
  }
});

// Helper functions for common logging patterns
export const logError = (error: Error | unknown, context?: Record<string, unknown>) => {
  if (error instanceof Error) {
    logger.error({ err: error, ...context }, error.message);
  } else {
    logger.error({ error, ...context }, 'Unknown error occurred');
  }
};

export const logInfo = (message: string, context?: Record<string, unknown>) => {
  logger.info(context, message);
};

export const logWarn = (message: string, context?: Record<string, unknown>) => {
  logger.warn(context, message);
};

export const logDebug = (message: string, context?: Record<string, unknown>) => {
  logger.debug(context, message);
};
