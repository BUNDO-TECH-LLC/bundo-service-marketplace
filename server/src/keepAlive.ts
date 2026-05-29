import { env } from './config/env';
import logger from './utils/logger';

const DEFAULT_INTERVAL_MS = 14 * 60_000; // Just under Render's ~15min idle window.
const MIN_INTERVAL_MS = 60_000;

let timer: NodeJS.Timeout | null = null;

/**
 * Opt-in self-ping that keeps the Node process and Postgres pool warm by hitting
 * KEEP_ALIVE_URL on an interval. This complements (does not replace) an external
 * uptime cron, which is what actually wakes a spun-down free-tier instance.
 */
export function startKeepAlive(): void {
  const url = env.KEEP_ALIVE_URL;
  if (!url) {
    return;
  }

  const parsedInterval = env.KEEP_ALIVE_INTERVAL_MS
    ? Number.parseInt(env.KEEP_ALIVE_INTERVAL_MS, 10)
    : NaN;
  const interval = Number.isFinite(parsedInterval)
    ? Math.max(parsedInterval, MIN_INTERVAL_MS)
    : DEFAULT_INTERVAL_MS;

  const ping = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        logger.warn({ url, status: res.status }, 'Keep-alive ping returned non-2xx');
      }
    } catch (error) {
      logger.warn({ url, err: error }, 'Keep-alive ping failed');
    }
  };

  timer = setInterval(ping, interval);
  timer.unref();
  logger.info({ url, interval }, 'Keep-alive ping enabled');
}

export function stopKeepAlive(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
