# Production deploy runbook

Use this after pushing to `main` or when standing up a new environment.

## Database

```bash
cd server
npm run db:migrate:deploy:pooler   # or db:migrate:deploy
npm run db:seed                    # required — syncs service categories
```

## First admin user

All Firebase sign-ups default to `CUSTOMER`. Promote your operator once:

```sql
UPDATE users SET role = 'ADMIN' WHERE firebase_uid = '<your-firebase-uid>';
```

Or use Prisma Studio: `npm run db:studio` → `users` → set `role` to `ADMIN`.

Secure that Firebase account with MFA before launch.

## Pre-launch / retest data purge

Use when you need to **free test emails** while keeping your operator account and live marketplace listings.

From `server/` with production `DATABASE_URL` and Firebase env vars loaded:

```bash
PURGE_CONFIRM=YES npm run db:purge -- --keep-admin-email=you@bundo.ng --firebase
npm run db:seed
```

**Keeps by default:**
- Admin account(s) you specify
- **Approved artisans with at least one offering** (listings stay on the marketplace)

**Removes:**
- All other users (customers, applicants, unlisted artisans)
- Bookings, messages, payments, reviews, and other transactional data

Add `--no-keep-listed-artisans` for the old behaviour (wipe all artisans/listings except admins).

You can use `--keep-admin-uid=<firebase-uid>` instead of email if you prefer.

## Paystack (live payments)

On Render:

- `PAYSTACK_SECRET_KEY=sk_live_...`
- `PAYSTACK_CALLBACK_URL=https://bundo-service-marketplace.vercel.app/workspace/bookings`
- Register webhook: `https://bundo-service-marketplace.onrender.com/webhooks/paystack`

Verify `GET /ready` shows `paystackMode: "live"`.

## Keep API warm (Render)

Set `KEEP_ALIVE_URL=https://bundo-service-marketplace.onrender.com/health` on the API service, or use the GitHub keepalive workflow with `vars.KEEPALIVE_URL`.

## Firebase App Check (recommended)

1. Create reCAPTCHA v3 site key in Firebase Console.
2. Vercel: `VITE_FIREBASE_APP_CHECK_SITE_KEY`
3. Render: `FIREBASE_APP_CHECK_ENFORCE=true` after verifying tokens flow.

## Support contact

Monitored inbox: **support@bundo.ng** (see `client/src/constants/support.ts`).
