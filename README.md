# Bundo

Service marketplace connecting customers with artisans: Firebase auth, Express API, Prisma/PostgreSQL, React (Vite) client, Paystack payments, and admin operations.

## Quick start

1. **Backend:** copy `server/.env.example` to `server/.env`, fill required variables (database, Firebase Admin, Cloudinary; optional Paystack for real money flows).
2. **Frontend:** copy `client/.env.example` to `client/.env` and set `VITE_API_BASE_URL` to your API origin (e.g. `http://127.0.0.1:3000`).
3. From the repo root:

```bash
npm run db:migrate   # after DATABASE_URL is set
npm run dev:server   # API on PORT (default 3000)
npm run dev:client   # Vite on port 5173
```

## Documentation

Product architecture, API index, payment flows, and launch checklist live in **[docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md)**. Start there for onboarding.

## Scripts (root `package.json`)

| Script            | Purpose                          |
|-------------------|----------------------------------|
| `dev:client`      | Vite dev server                  |
| `dev:server`      | Express API with hot reload      |
| `build`           | Build server then client         |
| `db:migrate`      | Prisma migrate                   |
| `db:seed` / `db:studio` | Seed / Prisma Studio       |
| `test`            | Server unit tests (Vitest)      |

## Repository layout

- `client/` — React SPA
- `server/` — Express API, Prisma schema and migrations
- `docs/` — Project guide and operational notes
