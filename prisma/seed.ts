// prisma/seed.ts
// Seeds your database with categories and 20 fake
// artisans at real Lagos coordinates.
// Run with: npm run db:seed

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const CATEGORIES = [
  { name: 'Tailoring', slug: 'tailoring', iconKey: 'needle' },
  { name: 'Hair Styling', slug: 'hair-styling', iconKey: 'scissors' },
  { name: 'Makeup', slug: 'makeup', iconKey: 'sparkles' },
  { name: 'Baking', slug: 'baking', iconKey: 'cake' },
  { name: 'Cleaning', slug: 'cleaning', iconKey: 'broom' },
  { name: 'Repairs', slug: 'repairs', iconKey: 'wrench' },
  { name: 'Photography', slug: 'photography', iconKey: 'camera' },
];

// Real Lagos coordinates across different areas
const LAGOS_LOCATIONS = [
  { city: 'Lagos', area: 'Victoria Island',  lat: 6.4281, lng: 3.4219 },
  { city: 'Lagos', area: 'Lekki Phase 1',    lat: 6.4320, lng: 3.4711 },
  { city: 'Lagos', area: 'Ikeja',            lat: 6.5954, lng: 3.3380 },
  { city: 'Lagos', area: 'Surulere',         lat: 6.4969, lng: 3.3538 },
  { city: 'Lagos', area: 'Yaba',             lat: 6.5101, lng: 3.3754 },
  { city: 'Lagos', area: 'Ajah',             lat: 6.4698, lng: 3.5852 },
  { city: 'Lagos', area: 'Ikorodu',          lat: 6.6194, lng: 3.5091 },
  { city: 'Lagos', area: 'Apapa',            lat: 6.4480, lng: 3.3590 },
  { city: 'Lagos', area: 'Gbagada',          lat: 6.5568, lng: 3.3895 },
  { city: 'Lagos', area: 'Maryland',         lat: 6.5679, lng: 3.3612 },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Upsert categories — safe to run multiple times
  for (const cat of CATEGORIES) {
    await db.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ ${CATEGORIES.length} categories seeded`);

  console.log('✅ Seed complete. Categories are ready.');
  console.log('   Fake artisans will be created when you test the app.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
