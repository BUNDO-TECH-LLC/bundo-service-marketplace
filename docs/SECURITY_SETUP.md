# Security setup (manual console steps)

Code changes are deployed from `main`. Complete these in each provider dashboard.

## Render (API)

| Variable | Value |
|----------|--------|
| `SENTRY_DSN` | From sentry.io → project → DSN |
| `CORS_EXTRA_ORIGINS` | Optional Vercel preview URLs, comma-separated |
| `CORS_ALLOW_VERCEL_PREVIEWS` | `true` only if you need any `*.vercel.app` preview |
| `FIREBASE_APP_CHECK_ENFORCE` | `true` **after** App Check is configured on client |

**Render Starter ($7):** Dashboard → service → Settings → Instance type → **Starter** (always-on). Do this last.

## Vercel (client)

| Variable | Value |
|----------|--------|
| `VITE_SENTRY_DSN` | Same Sentry project (browser DSN) |
| `VITE_FIREBASE_APP_CHECK_SITE_KEY` | Firebase Console → App Check → reCAPTCHA v3 site key |

Redeploy after changing `VITE_*` variables.

## Firebase Console

1. **Authentication → Settings → Authorized domains** — add `bundo-service-marketplace.vercel.app`
2. **Project settings → General** — restrict Web API key by HTTP referrer (your Vercel domains)
3. **App Check → Register** web app → reCAPTCHA v3 → copy site key to Vercel
4. **App Check → Debug tokens** — for local dev, add token from browser console when using `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN`

After client App Check works, set `FIREBASE_APP_CHECK_ENFORCE=true` on Render.

## Sentry

1. Create project at [sentry.io](https://sentry.io) (React + Node)
2. Copy DSN to Render `SENTRY_DSN` and Vercel `VITE_SENTRY_DSN`
3. Redeploy both services

## Paystack

Webhook URL (unchanged): `https://bundo-service-marketplace.onrender.com/webhooks/paystack`
