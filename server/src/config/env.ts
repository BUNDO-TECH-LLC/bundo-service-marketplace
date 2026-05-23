// src/config/env.ts
// ─────────────────────────────────────────────
// Validates all required environment variables
// at startup. If anything is wrong, the server
// refuses to start with a clear error message.
// String values are trimmed so pasted API keys
// and URLs do not break signatures or Paystack.
// Production adds stricter checks for live deploy (Postgres host, HTTPS CORS, etc.).
// ─────────────────────────────────────────────

import 'dotenv/config';
import { z } from 'zod';

const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

const stripQuotes = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const emptyToUndefined = (value: unknown) => {
  const trimmed = trim(value);
  if (trimmed === '' || trimmed === undefined || trimmed === null) {
    return undefined;
  }
  return trimmed;
};

function corsOriginEntries(corsOrigin: string): string[] {
  return corsOrigin.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function databaseHostIsLoopback(urlStr: string): boolean {
  try {
    const normalized = urlStr.replace(/^postgresql:/i, 'postgres:');
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1'
    );
  } catch {
    return false;
  }
}

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

    CLOUDINARY_CLOUD_NAME: z.preprocess(stripQuotes, z.string().min(1)),
    CLOUDINARY_API_KEY: z.preprocess(stripQuotes, z.string().min(1)),
    CLOUDINARY_API_SECRET: z.preprocess(stripQuotes, z.string().min(1)),

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
          'PAYSTACK_CALLBACK_URL is required when PAYSTACK_SECRET_KEY is set. Use your deployed frontend URL (https://...) where Paystack appends ?reference=..., e.g. https://yourdomain.com/workspace/bookings',
        path: ['PAYSTACK_CALLBACK_URL'],
      });
    }
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') {
      return;
    }

    if (data.ALLOW_PAYMENT_SIMULATION === 'true') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'ALLOW_PAYMENT_SIMULATION must not be enabled in production. Remove it or set it to false.',
        path: ['ALLOW_PAYMENT_SIMULATION'],
      });
    }

    for (const origin of corsOriginEntries(data.CORS_ORIGIN)) {
      try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'https:') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `CORS_ORIGIN must use https in production (got: ${origin}).`,
            path: ['CORS_ORIGIN'],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `CORS_ORIGIN contains an invalid URL: ${origin}`,
          path: ['CORS_ORIGIN'],
        });
      }
    }

    if (databaseHostIsLoopback(data.DATABASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'DATABASE_URL must not use localhost or 127.0.0.1 as the host in production. Use your managed Postgres hostname.',
        path: ['DATABASE_URL'],
      });
    }

    if (databaseHostIsLoopback(data.DIRECT_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'DIRECT_URL must not use localhost or 127.0.0.1 as the host in production. Use your managed Postgres hostname.',
        path: ['DIRECT_URL'],
      });
    }

    if (
      !data.FIREBASE_PRIVATE_KEY.includes('BEGIN') ||
      !data.FIREBASE_PRIVATE_KEY.includes('PRIVATE KEY')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'FIREBASE_PRIVATE_KEY does not look like a PEM private key (expect BEGIN … PRIVATE KEY block).',
        path: ['FIREBASE_PRIVATE_KEY'],
      });
    }

    if (data.PAYSTACK_SECRET_KEY && data.PAYSTACK_CALLBACK_URL) {
      try {
        const parsed = new URL(data.PAYSTACK_CALLBACK_URL);
        if (parsed.protocol !== 'https:') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'PAYSTACK_CALLBACK_URL must use https:// in production.',
            path: ['PAYSTACK_CALLBACK_URL'],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PAYSTACK_CALLBACK_URL is not a valid URL.',
          path: ['PAYSTACK_CALLBACK_URL'],
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Missing or invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
