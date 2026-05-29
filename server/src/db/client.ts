// src/db/client.ts

import { PrismaClient } from '@prisma/client';
import { Pool, type PoolConfig } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import logger from '../utils/logger';

// Extend globalThis safely
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function buildPoolConfig(connectionString: string): PoolConfig {
  const parsed = new URL(connectionString);

  // Let node-postgres use the explicit ssl object below instead of inheriting
  // stricter SSL semantics from sslmode in the URL during local development.
  parsed.searchParams.delete('sslmode');

  const toInt = (value: string | undefined, fallback: number) => {
    const parsedValue = value ? Number.parseInt(value, 10) : NaN;
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
  };

  return {
    connectionString: parsed.toString(),
    ssl: {
      rejectUnauthorized: false,
    },
    // Bound the pool so we don't exhaust the database connection limit (Render
    // managed Postgres caps connections aggressively). Tunable via env.
    max: toInt(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis: toInt(process.env.PG_POOL_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: toInt(process.env.PG_POOL_CONNECTION_TIMEOUT_MS, 10_000),
  };
}

// Create or reuse pool
const pool =
  globalForPrisma.pgPool ??
  new Pool(buildPoolConfig(env.DATABASE_URL));

// Create adapter
const adapter = new PrismaPg(pool);

// Create or reuse Prisma client
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter, // ✅ Prisma v7 requires adapter
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

// Prevent multiple instances in dev
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
  globalForPrisma.pgPool = pool;
}

let isShuttingDown = false;

// Graceful shutdown
process.on('beforeExit', async () => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  await db.$disconnect();
  await pool.end();
  logger.info('Database connection closed');
});

export default db;
