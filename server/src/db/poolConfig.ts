import type { PoolConfig } from 'pg';

export function buildPoolConfig(connectionString: string): PoolConfig {
  const parsed = new URL(connectionString);
  const sslDisabled = parsed.searchParams.get('sslmode') === 'disable';

  // Let node-postgres use the explicit ssl object below instead of inheriting
  // stricter SSL semantics from sslmode in the URL (Supabase pooler certs).
  parsed.searchParams.delete('sslmode');

  const toInt = (value: string | undefined, fallback: number) => {
    const parsedValue = value ? Number.parseInt(value, 10) : NaN;
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
  };

  const config: PoolConfig = {
    connectionString: parsed.toString(),
    max: toInt(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis: toInt(process.env.PG_POOL_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: toInt(process.env.PG_POOL_CONNECTION_TIMEOUT_MS, 10_000),
  };

  if (!sslDisabled) {
    config.ssl = {
      rejectUnauthorized: false,
    };
  }

  return config;
}
