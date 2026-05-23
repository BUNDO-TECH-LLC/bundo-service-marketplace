import logger from './utils/logger';

type SentryModule = typeof import('@sentry/node');

let sentry: SentryModule | null = null;

export function initObservability() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require('@sentry/node') as SentryModule;
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    logger.info('Sentry error reporting enabled');
  } catch (error) {
    logger.warn({ error }, 'SENTRY_DSN is set but @sentry/node is not installed');
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (sentry) {
    sentry.withScope((scope) => {
      if (context) {
        scope.setContext('bundo', context);
      }
      sentry!.captureException(error);
    });
    return;
  }

  logger.error({ error, ...context }, 'Unhandled error');
}
