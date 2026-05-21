# Client architecture

The live Bundo web app uses **React Router** with lazy-loaded route pages and a single app-wide context for session and marketplace data.

## Entry and routing

```
main.tsx
  └── BrowserRouter
        └── App.tsx                    # thin shell (~15 lines)
              └── AppProvider.tsx        # auth, data, route sync, context
                    └── AppRoutes.tsx    # all URL routes
```

### Routes (`app/AppRoutes.tsx`)

| Path | Page | Layout |
|------|------|--------|
| `/` | `HomePage` | `MainLayout` |
| `/marketplace` | `MarketplacePage` | `MainLayout` |
| `/workspace/:section` | `WorkspacePage` | `MainLayout` |
| `/admin/:section` | `AdminPage` | `MainLayout` |
| `/help`, `/help/:topicId` | `HelpPage` | `MainLayout` |
| `/artisans/:id` | `ArtisanProfileRoute` | `MainLayout` |
| `/verify-email` | `EmailVerificationPage` | `AuthLayout` |
| `/loading` | `LoadingPage` | none |

Login, signup, and password reset use the header **auth drawer** on `MainLayout`. Signup is **auth first, role second**: account form (phone required) → email verify (if needed) → client/artisan choice. Marketing links (`?role=artisan`) pre-select artisan on the role step only. Legacy paths redirect to `/?auth=…` (see `authDrawerPrompt.ts`, `AuthDrawerRedirect.tsx`).

## Folder layout

```
src/
  app/              # Shell: routes, layout, global provider, context
  features/         # Domain UI (marketing, marketplace, artisan, booking, account)
    artisan/
      landing/      # Onboarding wizard: hook + step components + phase router
  pages/            # Route-level components (thin; compose features + hooks)
  panels/           # Workspace sub-panels (bookings, chat, notifications)
  admin/            # Admin console panels
  views/            # Larger flows (dashboard, pending approval shells)
  components/       # Shared presentational / form widgets
  hooks/            # App-level hooks (auth, data, push, actions)
  lib/              # API, Firebase, formatting, path helpers
  layouts/          # Auth marketing backdrop wrapper
  auth/             # Header auth modal (`AuthBox`)
  help/             # Help center content
  types.ts          # Shared TS types
  appTypes.ts       # App-specific unions (View, AdminSection, …)
```

## State and data

- **`AppProvider`** composes `useAppAuth`, `useAppData`, `useAppRouteSync`, `useAppPush`, and `useActionRunner`.
- **`useAppRoot()`** exposes session, marketplace filters, bookings, admin payloads, and navigation helpers to any child.
- Route-derived UI state (`view`, `workspaceSection`, `adminSection`) is kept in sync with `location.pathname` via `parseAppPath` (`lib/appPaths.ts`).

## Artisan onboarding (`features/artisan/landing/`)

| File | Role |
|------|------|
| `useArtisanLanding.ts` | Fetches profile/KYC/portfolio; save steps; verification phase |
| `ArtisanLandingPhases.tsx` | Loading, pending approval, rejected, approved redirect |
| `ArtisanLandingSetupWizard.tsx` | 4-step stepper + footer actions |
| `ArtisanLandingStepBasic.tsx` | Step 1 — profile basics |
| `ArtisanLandingStepPricing.tsx` | Step 2 — service packages |
| `ArtisanLandingStepSubmit.tsx` | Step 4 — availability + KYC upload |
| `ArtisanLanding.tsx` | Chooses phases vs setup wizard |

Step 3 reuses [ArtisanOnboardingMediaStep.tsx](src/views/ArtisanOnboardingMediaStep.tsx).

## What not to use

- **`app/appShellComponents.tsx`** — deprecated re-export barrel; import from `features/*` instead.
- **Duplicate import blocks** — each feature file should only import what it uses (split-script leftovers were trimmed May 2026).

## Adding a new screen

1. Add a lazy import and `<Route>` in `app/AppRoutes.tsx`.
2. Create a thin page under `pages/` that reads `useAppRoot()` and composes `features/` + `panels/`.
3. Put reusable UI in `features/<domain>/` or `components/`.
4. Extend `VALID_*_SECTIONS` in `lib/appPaths.ts` if the path needs validation.

## Verification

```bash
cd client && npm run build
cd ../server && npm test
```
