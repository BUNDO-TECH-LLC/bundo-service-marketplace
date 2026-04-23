// src/db/client.ts

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import logger from '../utils/logger';

// Extend globalThis safely
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const connectionString = env.DATABASE_URL;

// Create or reuse pool
const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // ✅ required for Supabase
  });

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
