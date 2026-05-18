# Bundo

Service marketplace connecting customers with artisans: Firebase auth, Express API, Prisma/PostgreSQL, React (Vite) client, Paystack payments, and admin operations.

## Quick start

1. **Backend:** copy `server/.env.example` to `server/.env`, fill required variables (database, Firebase Admin, Cloudinary; optional Paystack for real money flows).
2. **Frontend:** copy `client/.env.example` to `client/.env` and set `VITE_API_BASE_URL` to your API origin (e.g. `http://127.0.0.1:3000`).
3. From the repo root:

```bash
npm run db:migrate        # prisma migrate dev (local)
npm run dev:server        # API on PORT (default 3000)
npm run dev:client        # Vite on port 5173
```

**Verify everything builds:**

```bash
npm run build   # server tsc + client tsc/vite
npm test        # server unit tests (Vitest)
```

**Production database:** `cd server && npm run db:migrate:deploy:pooler` (recommended for Supabase) or `db:migrate:deploy` when `DIRECT_URL` uses the session pooler on port 5432. See [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md).

**Production URLs:** Web https://bundo-service-marketplace.vercel.app · API https://bundo-service-marketplace.onrender.com

## Documentation

Product architecture, API index, payment flows, deployment steps, and launch checklist live in **[docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md)**. Start there for onboarding.

## Deploy checklist (production)

1. `npm run build` and `npm test` locally (or rely on CI on `main`).
2. `cd server && npm run db:migrate:deploy:pooler` on the production database.
3. Push to `main`; Vercel rebuilds the client when connected. On Render, trigger **Manual Deploy** (or confirm auto-deploy from `main`) for the API service.
4. Confirm `VITE_API_BASE_URL`, `CORS_ORIGIN`, and `PAYSTACK_CALLBACK_URL` match your live URLs.

## Scripts (root `package.json`)

| Script            | Purpose                          |
|-------------------|----------------------------------|
| `dev:client`      | Vite dev server                  |
| `dev:server`      | Express API with hot reload      |
| `build`           | Build server then client         |
| `db:migrate`      | Prisma migrate (dev)             |
| `db:seed` / `db:studio` | Seed / Prisma Studio       |
| `test`            | Server unit tests (Vitest)      |
| `test:smoke`      | E2E lifecycle smoke (needs DB)  |

## Repository layout

- `client/` — React SPA
- `server/` — Express API, Prisma schema and migrations
- `docs/` — Project guide and operational notes
