// src/config/env.ts
// ─────────────────────────────────────────────
// Validates all required environment variables
// at startup. If anything is wrong, the server
// refuses to start with a clear error message.
// String values are trimmed so pasted API keys
// and URLs do not break signatures or Paystack.
// ─────────────────────────────────────────────

import 'dotenv/config';
import { z } from 'zod';

const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

const emptyToUndefined = (value: unknown) => {
  const trimmed = trim(value);
  if (trimmed === '' || trimmed === undefined || trimmed === null) {
    return undefined;
  }
  return trimmed;
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.preprocess(trim, z.string().default('3000')),
    CORS_ORIGIN: z.preprocess(trim, z.string().min(1)),

    DATABASE_URL: z.preprocess(trim, z.string().min(1)),
    DIRECT_URL: z.preprocess(trim, z.string().min(1)),

    FIREBASE_PROJECT_ID: z.preprocess(trim, z.string().min(1)),
    FIREBASE_PRIVATE_KEY: z.preprocess(trim, z.string().min(1)),
    FIREBASE_CLIENT_EMAIL: z.preprocess(trim, z.string().email()),

    CLOUDINARY_CLOUD_NAME: z.preprocess(trim, z.string().min(1)),
    CLOUDINARY_API_KEY: z.preprocess(trim, z.string().min(1)),
    CLOUDINARY_API_SECRET: z.preprocess(trim, z.string().min(1)),

    PAYSTACK_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    PAYSTACK_CALLBACK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    PLATFORM_FEE_PERCENT: z.preprocess(trim, z.string().default('10')),

    /**
     * When Paystack is not configured: only in non-production, setting to "true"
     * allows markPaymentReferencePaid to simulate PAID_HELD (for local demos).
     * Never set in production; production without PAYSTACK_SECRET_KEY rejects confirmation.
     */
    ALLOW_PAYMENT_SIMULATION: z.preprocess(emptyToUndefined, z.enum(['true', 'false']).optional()),
  })
  .superRefine((data, ctx) => {
    if (data.PAYSTACK_SECRET_KEY && !data.PAYSTACK_CALLBACK_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'PAYSTACK_CALLBACK_URL is required when PAYSTACK_SECRET_KEY is set. Use your deployed frontend URL (https://...) plus the path/query where the app reads Paystack redirect params, e.g. https://yourdomain.com/?view=workspace&section=bookings',
        path: ['PAYSTACK_CALLBACK_URL'],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Missing or invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
