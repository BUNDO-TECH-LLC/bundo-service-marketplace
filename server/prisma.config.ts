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

function migrationUrl() {
  const directUrl = process.env.DIRECT_URL;
  const databaseUrl = new URL(directUrl || env("DATABASE_URL"));

  return withRequiredSsl(databaseUrl.toString());
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
