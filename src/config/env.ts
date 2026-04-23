// src/config/env.ts
// ─────────────────────────────────────────────
// Validates all required environment variables
// at startup. If anything is missing, the server
// refuses to start with a clear error message.
// This saves you from silent failures where a
// missing env var causes a weird bug deep in a
// request handler instead of failing at boot.
// ─────────────────────────────────────────────

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),

  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_CALLBACK_URL: z.string().url().optional(),
  PLATFORM_FEE_PERCENT: z.string().default('10'),
});

// Parse and validate — throws if anything is wrong
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Missing or invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1); // Hard stop — don't start with bad config
}

export const env = parsed.data;
