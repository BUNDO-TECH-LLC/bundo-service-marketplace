type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;

export function initClientObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  void import('@sentry/react')
    .then((module) => {
      sentry = module;
      module.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
      });
    })
    .catch(() => {
      console.warn('VITE_SENTRY_DSN is set but @sentry/react is not installed');
    });
}

export function captureClientException(error: unknown, context?: Record<string, unknown>) {
  if (sentry) {
    sentry.captureException(error, { extra: context });
    return;
  }

  console.error('Client error', error, context);
}
