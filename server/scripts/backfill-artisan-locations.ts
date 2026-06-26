/**
 * Backfill artisan profile locations against the Nigeria location catalog.
 *
 * Normalizes free-text city/area values so marketplace counts and filters stay accurate.
 * Safe by default: dry-run unless --apply is passed.
 *
 * Usage (from server/ with DATABASE_URL in .env):
 *   npm run db:backfill-artisan-locations
 *   npm run db:backfill-artisan-locations -- --verbose
 *   npm run db:backfill-artisan-locations -- --apply
 *   npm run db:backfill-artisan-locations -- --apply --limit=20
 *
 * Production: use the Postgres DATABASE_URL from Render → Environment (not the Render API key).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { buildPoolConfig } from '../src/db/poolConfig';
import { normalizeArtisanProfileLocation } from '../src/lib/normalizeArtisanLocationCatalog';

type CliOptions = {
  apply: boolean;
  verbose: boolean;
  limit: number | null;
};

function readArgs(argv: string[]): CliOptions {
  let apply = false;
  let verbose = false;
  let limit: number | null = null;

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }

    if (arg === '--verbose') {
      verbose = true;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      if (Number.isFinite(value) && value > 0) {
        limit = value;
      }
    }
  }

  return { apply, verbose, limit };
}

function formatRecord(city: string, area: string | null, lat: number, lng: number) {
  const areaLabel = area?.trim() ? `, ${area.trim()}` : '';
  return `${city.trim()}${areaLabel} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

async function main() {
  const options = readArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy server/.env.example to server/.env and paste your Postgres URL from Render (Environment) or Supabase.'
    );
  }

  const pool = new Pool(buildPoolConfig(databaseUrl));
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    const artisans = await db.artisanProfile.findMany({
      select: {
        id: true,
        displayName: true,
        city: true,
        area: true,
        lat: true,
        lng: true,
      },
      orderBy: { createdAt: 'asc' },
      ...(options.limit ? { take: options.limit } : {}),
    });

    const summary = {
      scanned: artisans.length,
      toUpdate: 0,
      alreadyCanonical: 0,
      unresolved: 0,
      areaMatches: 0,
      stateOnly: 0,
      applied: 0,
    };

    console.log(
      options.apply
        ? 'Applying artisan location backfill…'
        : 'Dry run — pass --apply to write changes.'
    );
    console.log(`Scanned ${summary.scanned} artisan profile(s).\n`);

    for (const artisan of artisans) {
      const result = normalizeArtisanProfileLocation({
        city: artisan.city,
        area: artisan.area,
        lat: artisan.lat,
        lng: artisan.lng,
      });

      if (result.match === 'unchanged' && !result.changed) {
        summary.unresolved += 1;
        if (options.verbose) {
          console.log(`? ${artisan.displayName}: ${result.reason}`);
        }
        continue;
      }

      if (result.match === 'area') {
        summary.areaMatches += 1;
      } else if (result.match === 'state_only') {
        summary.stateOnly += 1;
      }

      if (!result.changed) {
        summary.alreadyCanonical += 1;
        if (options.verbose) {
          console.log(`= ${artisan.displayName}: already canonical (${result.reason})`);
        }
        continue;
      }

      summary.toUpdate += 1;

      console.log(`${options.apply ? '→' : '•'} ${artisan.displayName}`);
      console.log(`  before: ${formatRecord(result.before.city, result.before.area, result.before.lat, result.before.lng)}`);
      console.log(`  after:  ${formatRecord(result.after.city, result.after.area, result.after.lat, result.after.lng)}`);
      console.log(`  match:  ${result.match} — ${result.reason}`);

      if (options.apply) {
        await db.artisanProfile.update({
          where: { id: artisan.id },
          data: {
            city: result.after.city,
            area: result.after.area,
            lat: result.after.lat,
            lng: result.after.lng,
          },
        });
        summary.applied += 1;
      }
    }

    console.log('\nSummary');
    console.log(`  scanned:            ${summary.scanned}`);
    console.log(`  would update:       ${summary.toUpdate}`);
    console.log(`  already canonical:  ${summary.alreadyCanonical}`);
    console.log(`  unresolved:         ${summary.unresolved}`);
    console.log(`  area matches:       ${summary.areaMatches}`);
    console.log(`  state-only updates: ${summary.stateOnly}`);
    if (options.apply) {
      console.log(`  applied:            ${summary.applied}`);
    } else if (summary.toUpdate > 0) {
      console.log('\nRe-run with --apply to persist these updates.');
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
