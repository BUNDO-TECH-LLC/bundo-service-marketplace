// src/utils/logger.ts
// ─────────────────────────────────────────────
// Pino is a structured JSON logger — much faster
// than console.log and gives you queryable logs
// in production. In development it pretty-prints.
// ─────────────────────────────────────────────

import pino from 'pino';

let transport: pino.LoggerOptions['transport'];

try {
  require.resolve('pino-pretty');
  transport =
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined;
} catch {
  transport = undefined;
}

const logger = pino({
  // Pretty print in development, raw JSON in production
  // Raw JSON is what Railway/log aggregators expect
  transport,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

export default logger;
