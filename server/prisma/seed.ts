// prisma/seed.ts
// Seeds your database with Bundo service categories.
// Run with: npm run db:seed

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { SERVICE_CATEGORIES } from '../src/config/serviceCategories';
import { buildPoolConfig } from '../src/db/poolConfig';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool(buildPoolConfig(databaseUrl));
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  const categories = SERVICE_CATEGORIES;
  const allowedSlugs = categories.map((cat) => cat.slug);

  for (const cat of categories) {
    await db.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        iconKey: cat.iconKey,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        iconKey: cat.iconKey,
      },
    });
  }

  const staleCategories = await db.category.findMany({
    where: { slug: { notIn: allowedSlugs } },
    include: { _count: { select: { offerings: true } } },
  });

  let removed = 0;
  for (const category of staleCategories) {
    if (category._count.offerings === 0) {
      await db.category.delete({ where: { id: category.id } });
      removed += 1;
    }
  }

  console.log(`✅ ${categories.length} service categories synced`);
  if (removed > 0) {
    console.log(`🧹 Removed ${removed} unused legacy categories`);
  }
  if (staleCategories.length > removed) {
    console.log(
      'ℹ️  Some legacy categories still have offerings linked. Reassign or delete them from Admin → Catalog.'
    );
  }
  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
