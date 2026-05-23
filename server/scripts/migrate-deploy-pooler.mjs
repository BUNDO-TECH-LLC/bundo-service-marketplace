/**
 * Runs `prisma migrate deploy` with DIRECT_URL derived from DATABASE_URL
 * (Supabase session pooler on port 5432). Use when db.<ref>.supabase.co does not resolve.
 */
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set in server/.env');
  process.exit(1);
}

let directUrl = databaseUrl.replace(':6543/', ':5432/').replace(':6543?', ':5432?');
if (directUrl === databaseUrl) {
  directUrl = databaseUrl.replace(/@([^:]+):6543/, '@$1:5432');
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: root,
  env: { ...process.env, DIRECT_URL: directUrl },
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
