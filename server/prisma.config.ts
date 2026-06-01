/// <reference types="node" />

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

function withRequiredSsl(url: string) {
  const parsed = new URL(url);

  if (!parsed.searchParams.has("sslmode")) {
    parsed.searchParams.set("sslmode", "require");
  }

  return parsed.toString();
}

function poolerSessionUrl(databaseUrl: string): string {
  let sessionUrl = databaseUrl.replace(':6543/', ':5432/').replace(':6543?', ':5432?');
  if (sessionUrl === databaseUrl) {
    sessionUrl = databaseUrl.replace(/@([^:]+):6543/, '@$1:5432');
  }
  return sessionUrl;
}

function migrationUrl() {
  const databaseUrl = env('DATABASE_URL');
  const directUrl = process.env.DIRECT_URL;

  // Supabase session pooler works from Render build VMs; legacy db.*.supabase.co direct
  // hosts often do not. Prefer an explicit pooler DIRECT_URL, otherwise derive :5432 from
  // DATABASE_URL (same logic as scripts/migrate-deploy-pooler.mjs).
  if (directUrl?.includes('pooler.supabase.com')) {
    return withRequiredSsl(directUrl);
  }

  return withRequiredSsl(poolerSessionUrl(databaseUrl));
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl(),
  },
});
