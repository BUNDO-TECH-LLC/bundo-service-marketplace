# Bundo Project Guide

## What Bundo Is

Bundo is a service marketplace that connects customers with artisans. The current product supports:

- Firebase-authenticated users
- Signup role selection for `CUSTOMER` and `ARTISAN`, with `ADMIN` managed through admin tools
- Public artisan discovery
- 4-step artisan profile onboarding (optional portfolio photos; manage photos in Profile after approval)
- Artisan KYC submission and admin review
- Category-based offerings
- Booking requests with a full lifecycle: `REQUESTED` → `ACCEPTED` (appointment) → `ONGOING` → `COMPLETED`
- Artisan workspace (dashboard, jobs, messages, reviews, offers, notifications, profile) with full header navigation
- Direct chat between customer and artisan, with image attachments
- Reviews for completed jobs
- In-app notifications
- Push-ready notification delivery through Firebase Cloud Messaging token storage
- Admin moderation (inline job queue, moderator assignment per booking, mobile-friendly console)
- Marketplace-style payments through Paystack
- Held funds, disputes, and admin-controlled payout release

The frontend lives in `client/`, the backend API lives in `server/src/`, and the Prisma/database assets live in `server/prisma/`.

Current launch-oriented structure:

- `client/` for the React/Vite frontend
- `server/` for the Express API, Prisma schema, migrations, and backend environment files
- `docs/` for operational and product documentation
- root `package.json` as the shared entrypoint for running both sides cleanly
- root [README.md](/Users/macbook/bundo/README.md) for quick start commands and a pointer into this guide

**Production URLs:** Web https://bundo-service-marketplace.vercel.app · API https://bundo-service-marketplace.onrender.com

---

## Recent changes (May 2026)

Shipped on `main` (newest first):

| Commit / area | Summary |
|---------------|---------|
| **Pre-launch polish (May 19)** | Account **Settings** hub at `/workspace/settings` (personal, business, phone, email, language, notifications, password, delete account); `DELETE /users/account`; mobile settings layout; icon topbar for signed-in users; **artisan workspace** icon nav (`ArtisanTopbarNav`) aligned with customer topbar; shared **Bundo loading** mark (`BundoLoadingMark`) for bootstrap, `/loading`, and artisan gate; **auth drawer** stability; **`/terms`** and **`/privacy`** legal pages; support email `support@bundo.ng`. |
| **Forgot password** (`476eac9`) | Dedicated `/forgot-password` page (`ForgotPassword.tsx`, `AuthLayout`); Firebase reset via `sendBundoPasswordResetEmail` with continue URL → `/login`; login links here with optional `?email=`; removed inline reset from `AuthPage`. |
| **CI Postgres SSL** (`fc0dbf9`) | GitHub Actions smoke job uses `sslmode=disable` for the local Postgres service so `prisma migrate deploy` succeeds (Prisma config defaults to `sslmode=require`). |
| **Client architecture refactor** (`b9240a0`) | Thin `App.tsx` → `AppProvider` + hooks (`useAppAuth`, `useAppData`, `useAppRouteSync`, …); domain UI under `client/src/features/*`; artisan onboarding split into `features/artisan/landing/`; dedicated auth routes `/login`, `/signup`, `/verify-email`; [client/ARCHITECTURE.md](/Users/macbook/bundo/client/ARCHITECTURE.md). |
| **Admin & artisan ops** (`07c1970`, `b1de47a`) | Paystack transfer webhooks; admin ledger/reviews; KYC Cloudinary upload; moderator assignment; legacy `LandingPage` / `AppRouter` removed; CI lifecycle smoke (with `PAID_HELD` seed after accept). |

**Removed / deprecated:** `LandingPage.tsx`, `AppRouter.tsx`, mock customer dashboard, `ArtisanPanel.tsx`, empty `pages/artisan/Dashboard.tsx`. Do not extend [appShellComponents.tsx](/Users/macbook/bundo/client/src/app/appShellComponents.tsx) — import from `features/*`.

---

## Full project analysis (current state)

### What Bundo is today

A **two-sided marketplace** for home and personal services in Nigeria: customers discover approved artisans, request bookings, pay through Paystack (held until completion), chat in-app, and leave reviews; artisans onboard with KYC, manage jobs in a workspace, and receive payouts to a Nigerian bank account; admins operate a control center for verification, jobs, money, and support chat.

### Technical stack

| Layer | Technology |
|-------|------------|
| Web | React 18, Vite, TypeScript, React Router, lazy routes, Tailwind-style CSS variables |
| API | Express 5, TypeScript, Prisma 7, PostgreSQL (Supabase in production) |
| Auth | Firebase Auth (email/password; Google in header `AuthBox` only) |
| Media | Cloudinary signed uploads (portfolio, KYC, chat images) |
| Payments | Paystack (initialize, verify, webhooks, transfers, disputes) |
| Push | Firebase Cloud Messaging (token storage; browser permission flow) |
| Hosting | Vercel (client), Render (API) |
| CI | GitHub Actions: server test+build, client build, Postgres smoke e2e |

### Backend capabilities (implemented)

- **Users:** Firebase token verification, role (`CUSTOMER` / `ARTISAN` / `ADMIN`), profile sync
- **Artisans:** Profile CRUD, portfolio images, availability slots, KYC submission, payout bank account, public discovery with approval gates
- **Catalog:** Categories and offerings (artisan-created; hidden until approved)
- **Bookings:** Full lifecycle with payment guards, rescheduling, conversation auto-creation, lifecycle chat messages
- **Payments:** Paystack checkout, `PAID_HELD`, confirm policy (production fail-closed without Paystack), disputes, admin release/refund, ledger entries, transfer webhooks (`transfer.success` / `failed` / `reversed`)
- **Chat:** Customer–artisan threads, admin support view, image attachments
- **Reviews:** Post-completion only, admin moderation
- **Admin:** Overview metrics, users, profiles, KYC queue, catalog, jobs (200 limit, moderator assign, inline chat), messages, reviews, finance/ledger, disputes
- **Ops:** `/health`, `/ready`, request IDs, structured logging

### Frontend capabilities (implemented)

- **Public:** Marketing home, marketplace filters/sort, artisan public profile, help center, **`/terms`**, **`/privacy`**
- **Auth routes:** `/login`, `/signup`, `/forgot-password`, `/verify-email` (dedicated pages + `AuthLayout` backdrop); header **auth drawer** (login/signup portal, not `/login` redirect)
- **Customer workspace:** Bookings, messages, notifications, **`/workspace/settings`** hub, leave review
- **Artisan:** 4-step onboarding wizard, pending-approval screen, `/workspace/*` (dashboard, jobs, messages, reviews, offers, notifications, profile with photos/KYC/bank/availability)
- **Admin:** `/admin/*` sections with mobile drawer
- **State:** `AppProvider` + `useAppRoot()`; path sync via `appPaths.ts`

### Known gaps (honest)

| Area | Status |
|------|--------|
| Paystack production E2E | Code + webhooks exist; **not fully verified** with live money and dashboard webhook URL |
| CI smoke e2e | Hardened (longer timeouts, single fork, `ALLOW_PAYMENT_SIMULATION` in smoke job); verify green on `main` |
| Google on `/login` | **Done** — shared `authSessionFlow` on `AuthPage` (same as header modal) |
| Apple Sign In | **Not implemented** — requires Apple Developer + Firebase provider setup |
| Search ranking | **Distance sort** via `sort=distance` + `lat`/`lng` (GPS or state centroid); not full geocoding |
| Observability | **Optional Sentry** when `SENTRY_DSN` / `VITE_SENTRY_DSN` are set; health/ready unchanged |
| Profile phone | **Editable** — `PATCH /users/phone` in Account settings + artisan profile form |
| Notification prefs | **Done** — `PATCH /users/notification-preferences`; enforced when creating notifications |
| Auth email deliverability | Firebase default sender; custom domain not configured |
| Terms / Privacy pages | **Done** — `/terms`, `/privacy`; linked from footer, signup, artisan onboarding |
| Account settings hub | **Done** — `/workspace/settings`; delete account via `DELETE /users/account` |
| Support contact | **Partial** — `BUNDO_SUPPORT_EMAIL` in legal pages; monitor inbox before launch |

### Maturity assessment

**Ready for controlled beta / soft launch** if you complete payment verification and manual QA on production. **Not ready for high-traffic public launch** until Paystack settlement is proven, CI smoke is stable, and basic alerting exists.

---

## Core Product Roles

### Customer

A customer can:

- sign up and sign in with Firebase
- choose the client path during signup
- browse artisans and offerings
- create bookings
- pay for bookings
- message artisans
- leave reviews on completed bookings
- raise disputes on held payments

### Artisan

An artisan can:

- choose the artisan path during signup or apply from profile settings
- complete a 4-step onboarding flow for basic info, services/pricing, optional portfolio photos, and availability
- create an artisan profile
- create service packages under categories during onboarding
- upload portfolio and availability data
- receive booking requests
- accept, decline, and complete bookings
- message customers
- configure a payout bank account
- submit KYC identity details for review
- use artisan workspace surfaces for dashboard, jobs, messages, reviews, offers, notifications, and profile settings (including portfolio photos)

### Admin

An admin can:

- review platform stats
- manage users and roles
- approve or reject artisan verification
- review artisan KYC submissions
- manage categories
- manage the **jobs queue**: filter by stage, confirm appointments, mark in progress or completed, release payouts, resolve disputes (loads up to **200** bookings per request; UI shows total vs loaded count)
- **assign a moderator** (another active `ADMIN` user) to any booking for multi-admin operations
- open the customer–artisan chat from any job entry (inline thread or full support view)
- inspect conversations globally, reply as Bundo support with text or images, and write internal admin notes
- moderate reviews in **Admin → Reviews** (`GET` / `DELETE /admin/reviews`)
- inspect ledger entries in **Admin → Finance** (`GET /admin/ledger-entries`)
- release held payments to artisans
- resolve disputes with release, full refund, or partial refund

---

## Backend Architecture

### Main server

The API entrypoint is:

- [src/server.ts](/Users/macbook/bundo/server/src/server.ts)

Mounted route groups:

- `/users`
- `/admin`
- `/artisans`
- `/bookings`
- `/categories`
- `/offerings`
- `/reviews`
- `/payments`
- `/webhooks/paystack`
- chat routes mounted at root for `/messages` and `/conversations`

### Shared backend services

- Firebase token verification middleware:
  [src/middlewares/verifyFirebaseToken.ts](/Users/macbook/bundo/server/src/middlewares/verifyFirebaseToken.ts)
- Role guard middleware:
  [src/middlewares/requireRole.ts](/Users/macbook/bundo/server/src/middlewares/requireRole.ts)
- Environment validation:
  [src/config/env.ts](/Users/macbook/bundo/server/src/config/env.ts)
- Firebase Admin boot:
  [src/config/firebase.ts](/Users/macbook/bundo/server/src/config/firebase.ts)
- Prisma client:
  [src/db/client.ts](/Users/macbook/bundo/server/src/db/client.ts)
- Payment confirmation gate (Paystack vs simulation policy):
  [src/modules/payments/paymentConfirmPolicy.ts](/Users/macbook/bundo/server/src/modules/payments/paymentConfirmPolicy.ts)
- Central HTTP errors and route wrappers:
  [src/middlewares/errorHandler.ts](/Users/macbook/bundo/server/src/middlewares/errorHandler.ts),
  [src/utils/errors.ts](/Users/macbook/bundo/server/src/utils/errors.ts),
  [src/utils/resultErrors.ts](/Users/macbook/bundo/server/src/utils/resultErrors.ts)
- Booking lifecycle rules (shared artisan + admin transitions):
  [src/lib/bookingStatus.ts](/Users/macbook/bundo/server/src/lib/bookingStatus.ts)
- Conversation linking and lifecycle chat messages on status changes:
  [src/lib/bookingConversations.ts](/Users/macbook/bundo/server/src/lib/bookingConversations.ts)
- Path-based notification deep links (aligned with the React router):
  [src/lib/appLinks.ts](/Users/macbook/bundo/server/src/lib/appLinks.ts)

Most API routes use `asyncHandler` so thrown `AppError` subclasses map to consistent JSON error responses.

---

## Booking status lifecycle

`BookingStatus` enum in Prisma:

| Status | Meaning |
|--------|---------|
| `REQUESTED` | Customer sent a booking; artisan has not decided. |
| `ACCEPTED` | Artisan (or admin) confirmed — **appointment**; customer and artisan are connected in chat. |
| `ONGOING` | Service work has started. |
| `COMPLETED` | Job finished; customer may leave a review; admin may release held payout. |
| `DECLINED` / `CANCELLED` | Closed without completion. |

**Who can change status**

- **Artisan** (`PATCH /bookings/:id/status`): accept/decline/cancel from `REQUESTED`; start service (`ONGOING`) and complete from `ACCEPTED`/`ONGOING`. Invalid jumps return **409**.
- **Admin** (`PATCH /admin/bookings/:id/status`): confirm appointment (`REQUESTED` → `ACCEPTED`), mark `ONGOING` / `COMPLETED`, or cancel. Same transition rules enforced server-side.

**Chat on lifecycle events**

- A conversation is created when the customer books (with an automatic booking summary message).
- When status becomes `ACCEPTED`, `ONGOING`, or `COMPLETED`, the backend appends a lifecycle message to that thread (artisan or admin as sender).
- Admin booking list responses include `conversationId` for support access.

Rules and tests: [bookingStatus.ts](/Users/macbook/bundo/server/src/lib/bookingStatus.ts), [bookingStatus.test.ts](/Users/macbook/bundo/server/src/lib/bookingStatus.test.ts).

Migration adding `ONGOING`: `server/prisma/migrations/20260516120000_add_booking_ongoing_status/`.

### Payment required before work starts or completes

Paystack checkout must complete and funds must reach a **secured** payment status (`PAID_HELD`, `PARTIALLY_RELEASED`, `RELEASED`, or `PARTIALLY_REFUNDED`) before:

- artisan or admin marks a job **in progress** (`ONGOING`)
- artisan or admin marks a job **completed**
- customer leaves a **review** on a completed job

Implemented in [bookingPayment.ts](/Users/macbook/bundo/server/src/lib/bookingPayment.ts) and enforced in:

- [bookings.service.ts](/Users/macbook/bundo/server/src/modules/bookings/bookings.service.ts) (artisan status updates → `409` / `PAYMENT_REQUIRED`)
- [admin.service.ts](/Users/macbook/bundo/server/src/modules/admin/admin.service.ts) (admin status updates)
- [reviews.service.ts](/Users/macbook/bundo/server/src/modules/reviews/reviews.service.ts) (reviews → `PAYMENT_NOT_SECURED`)

**Typical order:** request → accept → **pay** (Paystack) → start service → complete → review.

Client mirrors the same rules in [client/src/lib/bookingPayment.ts](/Users/macbook/bundo/client/src/lib/bookingPayment.ts) (disabled buttons and notices in bookings UI).

---

## Database Model Summary

The Prisma schema is here:

- [prisma/schema.prisma](/Users/macbook/bundo/server/prisma/schema.prisma)

Main business entities:

- `User`
- `ArtisanProfile`
- `Category`
- `Offering`
- `Booking` (optional `moderatorId` → assigned admin `User` for job support ownership)
- `Conversation`
- `Message`
- `Review`
- `Notification`
- `PortfolioImage`
- `AvailabilitySlot`
- `Payment`
- `ProviderPayoutAccount`
- `ArtisanKycSubmission`
- `Payout`
- `Dispute`
- `LedgerEntry`

### Payment-related tables

These power the marketplace money flow:

- `Payment`
  Stores total amount, platform fee, provider earning, status, Paystack reference, and authorization URL.
- `ProviderPayoutAccount`
  Stores artisan bank recipient details for Paystack transfer payouts.
- `Payout`
  Stores payout releases sent to artisans.
- `Dispute`
  Stores customer or artisan disputes tied to a booking.
- `LedgerEntry`
  Stores internal money events such as payment receipt, provider earning, payout release, and refunds.

---

## Frontend Architecture

The app uses **React Router** with lazy-loaded pages and a shared layout shell.

Entry and routing:

- [client/src/main.tsx](/Users/macbook/bundo/client/src/main.tsx) — `BrowserRouter`
- [client/src/app/AppRoutes.tsx](/Users/macbook/bundo/client/src/app/AppRoutes.tsx) — routes: `/`, `/marketplace`, `/workspace/:section`, `/admin/:section`, `/help`, `/artisans/:artisanId`, `/login`, `/signup`, `/forgot-password`, `/verify-email`
- [client/src/app/MainLayout.tsx](/Users/macbook/bundo/client/src/app/MainLayout.tsx) — global header/footer wrapper
- [client/src/app/appRootContext.tsx](/Users/macbook/bundo/client/src/app/appRootContext.tsx) — shared app state for pages

Path helpers (must stay aligned with server `appLinks.ts`):

- [client/src/lib/appPaths.ts](/Users/macbook/bundo/client/src/lib/appPaths.ts)
- [client/src/lib/workspaceRoute.ts](/Users/macbook/bundo/client/src/lib/workspaceRoute.ts)
- [client/src/lib/notificationNavigation.ts](/Users/macbook/bundo/client/src/lib/notificationNavigation.ts)

Pages:

- [client/src/pages/HomePage.tsx](/Users/macbook/bundo/client/src/pages/HomePage.tsx) — landing (Why Bundo, curated categories, social proof, footer)
- [client/src/pages/MarketplacePage.tsx](/Users/macbook/bundo/client/src/pages/MarketplacePage.tsx)
- [client/src/pages/WorkspacePage.tsx](/Users/macbook/bundo/client/src/pages/WorkspacePage.tsx)
- [client/src/pages/AdminPage.tsx](/Users/macbook/bundo/client/src/pages/AdminPage.tsx)
- [client/src/pages/HelpPage.tsx](/Users/macbook/bundo/client/src/pages/HelpPage.tsx)
- [client/src/pages/ArtisanProfileRoute.tsx](/Users/macbook/bundo/client/src/pages/ArtisanProfileRoute.tsx)

The app shell and global state:

- [client/src/App.tsx](/Users/macbook/bundo/client/src/App.tsx) — thin wrapper (`AppProvider` + `AppRoutes`)
- [client/src/app/AppProvider.tsx](/Users/macbook/bundo/client/src/app/AppProvider.tsx) — composes auth, data, route sync, push, and action runner hooks
- [client/src/pages/auth/ForgotPassword.tsx](/Users/macbook/bundo/client/src/pages/auth/ForgotPassword.tsx) — password reset email flow

Supporting client files:

- API helper:
  [client/src/lib/api.ts](/Users/macbook/bundo/client/src/lib/api.ts)
- Signup role and email-verification handoff in `localStorage`:
  [client/src/lib/authSignupStorage.ts](/Users/macbook/bundo/client/src/lib/authSignupStorage.ts)
- Shared formatting helpers (currency, message time, day labels):
  [client/src/lib/formatting.ts](/Users/macbook/bundo/client/src/lib/formatting.ts)
- Nigeria state list for forms:
  [client/src/lib/geo.ts](/Users/macbook/bundo/client/src/lib/geo.ts)
- Category icons for marketplace cards:
  [client/src/lib/categoryIcon.ts](/Users/macbook/bundo/client/src/lib/categoryIcon.ts)
- Marketing hero/device image URLs:
  [client/src/lib/marketingAssets.ts](/Users/macbook/bundo/client/src/lib/marketingAssets.ts)
- Display name helper for Firebase and API user objects:
  [client/src/lib/userDisplayName.ts](/Users/macbook/bundo/client/src/lib/userDisplayName.ts)
- `/me` fetch with token refresh retry:
  [client/src/lib/resolveApiSession.ts](/Users/macbook/bundo/client/src/lib/resolveApiSession.ts)
- Workspace local state reset (logout and similar):
  [client/src/lib/workspaceState.ts](/Users/macbook/bundo/client/src/lib/workspaceState.ts)
- Chat image upload to Cloudinary (signed upload then browser POST):
  [client/src/lib/chatUpload.ts](/Users/macbook/bundo/client/src/lib/chatUpload.ts)
- Booking and payment labels for UI (shared by bookings panel and admin):
  [client/src/lib/bookingDisplay.ts](/Users/macbook/bundo/client/src/lib/bookingDisplay.ts)
- Admin job filters and stage labels:
  [client/src/lib/adminJobStages.ts](/Users/macbook/bundo/client/src/lib/adminJobStages.ts)
- Notification label and relative time helpers:
  [client/src/lib/notificationDisplay.ts](/Users/macbook/bundo/client/src/lib/notificationDisplay.ts)
- Last-route persistence for workspace/admin restore:
  [client/src/lib/workspaceRoute.ts](/Users/macbook/bundo/client/src/lib/workspaceRoute.ts)
- Firebase web config:
  [client/src/lib/firebase.ts](/Users/macbook/bundo/client/src/lib/firebase.ts)
- Firebase web push helper:
  [client/src/lib/messaging.ts](/Users/macbook/bundo/client/src/lib/messaging.ts)
- Shared frontend types:
  [client/src/types.ts](/Users/macbook/bundo/client/src/types.ts)
- App navigation and admin record types used across screens and auth:
  [client/src/appTypes.ts](/Users/macbook/bundo/client/src/appTypes.ts)
- Small reusable UI:
  [client/src/components/EmptyState.tsx](/Users/macbook/bundo/client/src/components/EmptyState.tsx),
  [client/src/components/StatCard.tsx](/Users/macbook/bundo/client/src/components/StatCard.tsx)
- Auth surface (Firebase email/Google, verification, role completion), imported by `App.tsx`:
  [client/src/auth/AuthBox.tsx](/Users/macbook/bundo/client/src/auth/AuthBox.tsx)
- Email verification helpers and inbox guidance:
  [client/src/lib/authEmailVerification.ts](/Users/macbook/bundo/client/src/lib/authEmailVerification.ts),
  [client/src/components/EmailInboxHint.tsx](/Users/macbook/bundo/client/src/components/EmailInboxHint.tsx)
- Artisan portfolio upload/management (onboarding, pending, profile settings):
  [client/src/components/ArtisanPortfolioManager.tsx](/Users/macbook/bundo/client/src/components/ArtisanPortfolioManager.tsx),
  [client/src/lib/useArtisanPortfolio.ts](/Users/macbook/bundo/client/src/lib/useArtisanPortfolio.ts),
  [client/src/lib/portfolioUpload.ts](/Users/macbook/bundo/client/src/lib/portfolioUpload.ts),
  [client/src/lib/imageFile.ts](/Users/macbook/bundo/client/src/lib/imageFile.ts)
- Client shell, routes, and global state (May 2026 refactor):
  [client/ARCHITECTURE.md](/Users/macbook/bundo/client/ARCHITECTURE.md),
  [client/src/App.tsx](/Users/macbook/bundo/client/src/App.tsx) (thin entry),
  [client/src/app/AppRoutes.tsx](/Users/macbook/bundo/client/src/app/AppRoutes.tsx),
  [client/src/app/AppProvider.tsx](/Users/macbook/bundo/client/src/app/AppProvider.tsx),
  [client/src/app/MainLayout.tsx](/Users/macbook/bundo/client/src/app/MainLayout.tsx)
- Feature UI by domain (`client/src/features/`): marketing (Hero, Footer, …), marketplace (filters, grid), artisan (header, landing, offers, profile, reviews), booking, account
- Artisan onboarding wizard (4 steps) — logic in [useArtisanLanding.ts](/Users/macbook/bundo/client/src/features/artisan/landing/useArtisanLanding.ts); steps in `features/artisan/landing/ArtisanLandingStep*.tsx`; orchestrator [ArtisanLanding.tsx](/Users/macbook/bundo/client/src/features/artisan/ArtisanLanding.tsx)
- Artisan workspace header (full nav on desktop + mobile drawer):
  [client/src/features/artisan/ArtisanAppHeader.tsx](/Users/macbook/bundo/client/src/features/artisan/ArtisanAppHeader.tsx)
- Password visibility toggle on login/signup:
  [client/src/components/PasswordInput.tsx](/Users/macbook/bundo/client/src/components/PasswordInput.tsx)
- Logged-in customer home, artisan profile view, artisan dashboard:
  [client/src/views/LoggedInHome.tsx](/Users/macbook/bundo/client/src/views/LoggedInHome.tsx),
  [client/src/views/ArtisanProfilePage.tsx](/Users/macbook/bundo/client/src/views/ArtisanProfilePage.tsx),
  [client/src/views/ArtisanDashboard.tsx](/Users/macbook/bundo/client/src/views/ArtisanDashboard.tsx)
- Help center content and topic data:
  [client/src/help/HelpCenter.tsx](/Users/macbook/bundo/client/src/help/HelpCenter.tsx),
  [client/src/help/helpTopics.ts](/Users/macbook/bundo/client/src/help/helpTopics.ts)
- Admin console and section panels (overview, jobs, messages, KYC, profiles, catalog):
  [client/src/admin/AdminConsole.tsx](/Users/macbook/bundo/client/src/admin/AdminConsole.tsx),
  [client/src/admin/AdminOverviewPanel.tsx](/Users/macbook/bundo/client/src/admin/AdminOverviewPanel.tsx),
  [client/src/admin/AdminBookingsPanel.tsx](/Users/macbook/bundo/client/src/admin/AdminBookingsPanel.tsx) — inline job rows, moderator dropdown, appointment alerts, status actions, inline chat,
  [client/src/components/AdminPortfolioGallery.tsx](/Users/macbook/bundo/client/src/components/AdminPortfolioGallery.tsx) — portfolio thumbnails in KYC and artisan profile review,
  [client/src/admin/AdminJobChat.tsx](/Users/macbook/bundo/client/src/admin/AdminJobChat.tsx),
  [client/src/admin/AdminKycPanel.tsx](/Users/macbook/bundo/client/src/admin/AdminKycPanel.tsx),
  [client/src/admin/AdminProfilesPanel.tsx](/Users/macbook/bundo/client/src/admin/AdminProfilesPanel.tsx),
  [client/src/admin/AdminCatalogPanel.tsx](/Users/macbook/bundo/client/src/admin/AdminCatalogPanel.tsx),
  [client/src/admin/adminMetricLabel.ts](/Users/macbook/bundo/client/src/admin/adminMetricLabel.ts)
- Customer review dialog for completed bookings:
  [client/src/components/LeaveReviewDialog.tsx](/Users/macbook/bundo/client/src/components/LeaveReviewDialog.tsx)
- Workspace-oriented panels (imported into `App.tsx`):
  [client/src/panels/BookingsPanel.tsx](/Users/macbook/bundo/client/src/panels/BookingsPanel.tsx),
  [client/src/panels/ChatPanel.tsx](/Users/macbook/bundo/client/src/panels/ChatPanel.tsx),
  [client/src/panels/AdminChatPanel.tsx](/Users/macbook/bundo/client/src/panels/AdminChatPanel.tsx),
  [client/src/panels/NotificationsPanel.tsx](/Users/macbook/bundo/client/src/panels/NotificationsPanel.tsx)
- Global styling:
  [client/src/styles.css](/Users/macbook/bundo/client/src/styles.css)
- Firebase messaging service worker:
  [client/public/firebase-messaging-sw.js](/Users/macbook/bundo/client/public/firebase-messaging-sw.js)
- Historical one-off extractors (do not run against current tree without updating markers):
  [client/scripts/README.md](/Users/macbook/bundo/client/scripts/README.md)

The current frontend is a single-page React app that manages:

- home/landing experience
- discovery and artisan profile viewing
- workspace by role
- signup role choice for client or artisan
- logged-in customer home dashboard
- 4-step artisan onboarding wizard (step 3 portfolio photos are **optional** — “Skip for now” supported)
- approved artisans visiting `/` are **redirected** to `/workspace/overview` (no duplicate home dashboard + second header)
- artisan setup uses a sticky Bundo setup header and does not show workspace navigation before approval
- approved artisan **workspace** uses `ArtisanAppHeader` with Dashboard, Jobs, Messages, Reviews, Offers, Notifications, and Profile; global marketplace header is hidden on workspace routes
- artisan **Profile** settings: horizontal section nav (Profile / Photos / KYC / Bank); photos are the canonical portfolio home (not Offers)
- pending artisans can upload portfolio photos while awaiting approval
- chat with photo attachments
- bookings
- a dedicated admin operations console with sidebar navigation (desktop) and **mobile slide-out menu** + top bar; sections: overview, profiles, jobs, messages, verification, catalog
- admin **Jobs**, **Profiles**, and **KYC** lists use **inline row** layout (not large cards) for better scanning on mobile
- admin sessions do not show the customer/artisan marketplace navbar
- URL-based navigation (`/workspace/bookings`, `/admin/jobs`, etc.) instead of query-string views
- payment actions in the booking flow
- help-center and trust-policy content for payments, disputes, cancellations, KYC, privacy, and support

`App.tsx` still owns routing, data loading, marketplace, onboarding, and many feature-specific components; **auth**, **views** (customer home, artisan profile, artisan dashboard), **help**, **admin** console stack, and the largest **panels** live in their own modules under `client/src/`, with shared display and session helpers in `client/src/lib/`.

---

## End-to-End Product Flows

## 1. Authentication and user bootstrap

1. User signs up or logs in with Firebase on the frontend.
2. Signup asks the user to choose client or artisan before account creation.
3. User can continue with Google or email/name/password. Email signup requires a standard password and verify-password confirmation before the Firebase account is created.
4. Email/password signup sends a Firebase email verification link (via `sendBundoEmailVerification` in [authEmailVerification.ts](/Users/macbook/bundo/client/src/lib/authEmailVerification.ts)) with continue URL set to the current site origin before the user is synced into the Bundo backend.
5. Unverified email/password users stay on the verification screen with **[EmailInboxHint](/Users/macbook/bundo/client/src/components/EmailInboxHint.tsx)** guidance to check **spam/junk** and Promotions/Updates folders; they can resend the verification email or confirm after clicking the link.
6. The selected signup role is remembered locally during email verification, so an artisan who verifies in another tab and returns to login still continues into artisan onboarding.
7. Password reset is handled from the login drawer through Firebase password reset email.
8. Google sign-in uses Firebase Google Auth. Returning Google users continue directly; brand-new Google users choose client or artisan before their Bundo role is finalized.
9. Frontend gets a refreshed Firebase ID token after sign-in/verification.
10. Frontend calls `/me`.
11. Backend verifies the Firebase token.
12. Backend creates the user in the database if they do not exist.
13. Frontend stores the selected role through `/users/role` when needed.
14. A newly created artisan account is routed directly to the artisan profile/KYC setup surface.
15. If a verified account is restored without a Bundo role, the UI shows a role-completion prompt before marketplace actions such as booking are enabled.

Result:

- authenticated user exists in Firebase
- synchronized user exists in database
- role is stored in Bundo
- email/password users verify their email before entering the marketplace workspace
- verified artisan signups keep their selected role across the email verification handoff
- role-less verified users cannot silently enter a disabled booking state; they must finish client/artisan setup first
- password reset stays with Firebase Auth email templates (toasts also mention checking spam)
- verification deliverability is primarily controlled in **Firebase Console** (templates, authorized domains, optional custom sending domain with SPF/DKIM); the app cannot guarantee inbox placement without that setup
- casual client/artisan switching is not exposed in the profile UI
- artisan-to-client switching through the public role endpoint is blocked and should go through admin/support if needed

## 2. Artisan onboarding

1. User chooses artisan during signup or applies as artisan from profile settings.
2. Artisan lands on the 4-step onboarding flow.
3. Step 1, Basic info:
   - saves `ArtisanProfile` through `/artisans/profile`
   - captures full name, business/display name, category, and location
4. Step 2, Services and pricing:
   - creates one or more service packages through `/offerings`
   - each package captures category, service name, price, and description
   - packages can exist before approval, but public discovery only shows offerings attached to approved artisans
5. Step 3, Portfolio (**optional** — Option C):
   - artisan can upload photos or choose **Skip for now**
   - signs direct upload through `/artisans/portfolio-images/sign-upload` (shared [portfolioUpload.ts](/Users/macbook/bundo/client/src/lib/portfolioUpload.ts))
   - uploads one or more images to Cloudinary from the browser ([imageFile.ts](/Users/macbook/bundo/client/src/lib/imageFile.ts) accepts mobile files with empty MIME when extension is known)
   - stores portfolio image metadata through `/artisans/portfolio-images` (returns `201` + `{ image }`; `GET /portfolio-images/me` returns `[]` if no profile yet)
   - requires valid `CLOUDINARY_*` env vars; local E2E may fail with an invalid configured cloud name
   - **no minimum photo count** gates marketplace listing after approval
6. Step 4, Availability and submit:
   - saves availability through `/artisans/availability-slots`
   - submits KYC through `/artisans/kyc`
7. Admin reviews KYC and profile status.

Result:

- artisan profile and service setup are collected before public launch
- artisan becomes discoverable only after KYC/admin approval
- offerings created during onboarding stay hidden from public marketplace until the artisan is approved
- artisan can be approved and appear on the marketplace **without** portfolio photos; photos are managed anytime after profile exists in **Profile → Photos**

## 2B. Artisan KYC

1. Artisan reaches step 4 of onboarding or opens the artisan setup screen.
2. Artisan submits legal name, document details, address, and document URLs.
3. Backend stores or updates the KYC submission with `PENDING` status.
4. Admin reviews the submission from the admin control center.
5. Admin can mark it `APPROVED`, `REJECTED`, or `CHANGES_REQUESTED`.
6. KYC review syncs profile verification status:
   - KYC `APPROVED` sets artisan profile to `APPROVED`
   - KYC `REJECTED` sets artisan profile to `REJECTED`
   - KYC `CHANGES_REQUESTED` keeps artisan profile pending
7. Artisan receives an in-app notification about the review outcome.

Result:

- Bundo has a working trust and compliance layer before wider artisan rollout
- validated flow:
  artisan submit -> artisan fetch -> admin list -> admin review -> artisan sees final reviewed status

### Artisan awaiting approval (post-submit)

After step 4 submit, artisans with `PENDING` KYC are **not** left on the setup wizard:

- [ArtisanPendingApproval.tsx](/Users/macbook/bundo/client/src/views/ArtisanPendingApproval.tsx) — success screen, “profile awaiting approval”, timeline, optional **portfolio upload while pending**, and what unlocks after approval
- [ArtisanSetupShell.tsx](/Users/macbook/bundo/client/src/views/ArtisanSetupShell.tsx) — top bar with **Help** and account menu including **Log out** (global header stays hidden on artisan home during setup)
- [artisanVerification.ts](/Users/macbook/bundo/client/src/lib/artisanVerification.ts) — routes among setup, awaiting approval, changes requested, rejected, and approved
- Unapproved artisans who open `/workspace/*` are redirected to `/` with a notice

## 2C. Approved artisan workspace

After KYC/admin approval, artisans use **`/workspace/*`** (not a second dashboard on `/`):

1. Visiting `/` while approved **redirects** to `/workspace/overview` ([ArtisanLanding](/Users/macbook/bundo/client/src/features/artisan/ArtisanLanding.tsx) + `Navigate`).
2. **Dashboard** (`/workspace/overview`) — [ArtisanDashboard.tsx](/Users/macbook/bundo/client/src/views/ArtisanDashboard.tsx): booking totals, rating summary, active jobs, new requests, availability dots, quick links; soft nudge to add photos when approved with fewer than three portfolio images.
3. **Jobs** (`/workspace/bookings`) — bookings with filters (all, pending, accepted, in progress, completed, declined).
4. Booking detail (in jobs panel): accept/decline, **Start service** (`ONGOING`), **Mark completed**, open chat — gated by secured payment server-side and in UI.
5. **Messages** (`/workspace/messages`) — shared [ChatPanel](/Users/macbook/bundo/client/src/panels/ChatPanel.tsx).
6. **Reviews** (`/workspace/reviews`).
7. **Offers** (`/workspace/offers`) — [ArtisanOffersPanel](/Users/macbook/bundo/client/src/features/artisan/ArtisanOffersPanel.tsx); no portfolio or KYC here.
8. **Notifications** (`/workspace/notifications`).
9. **Profile** (`/workspace/profile`) — [ArtisanProfileSettings](/Users/macbook/bundo/client/src/features/artisan/ArtisanProfileSettings.tsx): hero + subnav (Profile / Photos / KYC / Bank); [ArtisanPortfolioManager](/Users/macbook/bundo/client/src/components/ArtisanPortfolioManager.tsx) for photos; KYC file upload via [KycImageUploadField](/Users/macbook/bundo/client/src/components/KycImageUploadField.tsx).

**ArtisanAppHeader** (workspace only): Dashboard, Jobs, Messages, Reviews, Offers, Notifications, Profile; unread badge on Notifications; Log out on desktop and in mobile menu.

Result:

- artisans have a role-specific workspace rather than the customer dashboard
- approved artisans land on `/workspace/overview`, not KYC or setup screens
- sensitive KYC and bank details live in Profile, not Offers
- booking lifecycle actions stay connected to `/bookings/:id/status`
- chat and reviews stay connected to the shared backend modules

## 3. Customer discovery and booking

1. Customer browses `/artisans` and `/offerings`.
2. Customer opens one artisan profile.
3. Customer creates a booking for an offering.
4. Booking starts in `REQUESTED`.
5. Backend creates or updates the customer-artisan conversation and inserts an automatic booking message.
6. Frontend shows a booking success confirmation with actions to go directly to messages or continue browsing while the request stays active.
7. Artisan accepts or declines (`ACCEPTED` posts a connection message in chat).
8. Customer pays via Paystack (`Pay securely` → `PAID_HELD`); artisan cannot start or complete until payment is secured.
9. Artisan marks **Start service** (`ONGOING`) then **Mark completed** (blocked server-side if unpaid).
10. Customer or artisan can reschedule while the booking is still `REQUESTED` or `ACCEPTED`.
11. Customer can chat throughout; payment notice shown when accepted but unpaid.
12. After `COMPLETED` with secured payment, customer submits a review via `POST /reviews`.

Result:

- booking connects customer, artisan, and offering
- every opened job has a standard message thread in both inboxes
- customers get a clear success state instead of only a toast notification
- customer dashboard navigation returns to the logged-in home dashboard; bookings, messages, and notifications remain separate workspace sections

## 4. Marketplace payment flow

1. Customer opens a booking and clicks `Pay securely`.
2. Frontend calls `POST /payments/initialize`.
3. Backend creates or reuses a `Payment`.
4. Backend calls Paystack transaction initialize.
5. Frontend receives Paystack hosted checkout URL and redirects.
6. After payment, one of two things confirms the transaction:
   - Paystack webhook calls `/webhooks/paystack`
   - local callback flow calls `POST /payments/verify-reference`
7. Backend applies the **payment confirmation policy** (see below): with `PAYSTACK_SECRET_KEY` set, Paystack is queried to verify the charge before any move to `PAID_HELD`. In **production**, if Paystack is not configured, confirmation is rejected and no ledger rows are written. In **non-production**, optional `ALLOW_PAYMENT_SIMULATION=true` allows marking `PAID_HELD` without Paystack for local UI demos only.
8. When verification succeeds (or simulation is explicitly allowed), the payment is marked `PAID_HELD`.
9. Ledger entries are created for:
   - customer payment
   - platform fee
   - provider earning

Result:

- funds are treated as held by the marketplace
- payout is not auto-sent to artisan
- production cannot silently confirm held payments without Paystack verification

### Payment confirmation policy (technical)

Rules are implemented in [paymentConfirmPolicy.ts](/Users/macbook/bundo/server/src/modules/payments/paymentConfirmPolicy.ts) and enforced in [payments.service.ts](/Users/macbook/bundo/server/src/modules/payments/payments.service.ts) inside `markPaymentReferencePaid`:

| Environment | `PAYSTACK_SECRET_KEY` | `ALLOW_PAYMENT_SIMULATION` | Behavior |
|-------------|------------------------|----------------------------|----------|
| any | set | ignored | Paystack API verification required before `PAID_HELD` + ledger |
| **production** | unset | any | **Reject** — returns `paystack_not_configured`, no DB promotion |
| non-production | unset | `true` | **Simulate** — logs a warning, promotes to `PAID_HELD` without Paystack (local demos only) |
| non-production | unset | unset / `false` | **Reject** — same as production fail-closed for money |

Environment templates: [server/.env.example](/Users/macbook/bundo/server/.env.example). Root [README.md](/Users/macbook/bundo/README.md) summarizes how to run the stack and where the guide lives.

## 5. Completion and payout release

1. Artisan (or admin) marks the booking `COMPLETED` (only if payment is already secured).
2. Payment remains held.
3. Admin reviews the job in the **Jobs** queue (filters, appointment alerts, disputes).
4. Admin triggers payout release from the job entry or dispute tools.
5. Backend calls Paystack transfer.
6. Backend stores `Payout`.
7. Payment becomes `RELEASED`.

Result:

- artisan gets paid after service completion and review

## 6. Dispute and refund flow

1. Customer opens a dispute on a held booking.
2. Admin sees the disputed booking.
3. Admin can resolve with:
   - `RELEASE`
   - `REFUND_FULL`
   - `REFUND_PARTIAL`
4. Refund actions call Paystack refund API.
5. Payment and ledger values are updated.
6. Dispute status becomes resolved.

Result:

- admin can protect customer trust while keeping payout control inside the marketplace

## 7. Reviews

1. Customer booking is `COMPLETED` and payment is secured (`PAID_HELD` or later).
2. Customer posts a review tied to that booking via `POST /reviews`.
3. Backend prevents duplicate booking reviews and rejects unpaid completed jobs (`PAYMENT_NOT_SECURED`).
4. Artisan average rating and rating count are recalculated.

Result:

- artisan trust score improves discovery quality

## 8. Messaging

1. Customer starts a conversation by sending a message.
2. Backend finds or creates the conversation.
3. Artisan replies in the same thread.
4. Customer, artisan, and admin support replies can include a message body, an image attachment, or both.
5. Image attachments are signed by the backend and uploaded directly to Cloudinary from the browser.
6. The workspace **Messages** tab polls for new messages about every **12 seconds** while open.
7. Admin can inspect conversations globally, open chat from a job row, reply as support, and attach internal notes.

Result:

- support and moderation visibility exist without exposing admin notes to users
- image evidence, references, and job photos can stay inside the booking conversation

## 9. Notifications

1. Important platform events create notifications automatically.
2. Notifications are stored per user in the database.
3. If a user has an FCM token saved, the backend also attempts Firebase push delivery.
4. The frontend notifications workspace can request browser permission and register a Firebase Messaging token.
5. That token is synced back to Bundo through `/users/fcm-token`.
6. Users can open notifications from the account menu.
7. Users can filter between all activity and unread items.
8. Users can mark one or all notifications as read.

Current notification-producing events:

- booking created
- booking cancelled
- booking accepted, declined, in progress (`ONGOING`), or completed
- customer payment secured
- provider payout released
- dispute opened
- dispute resolved
- new chat message
- new review
- artisan verification updated

Result:

- users get a persistent in-app event feed
- the backend is ready to fan out push notifications once the frontend registers real device tokens

## 10. Help center and trust policies

1. Users can open the help center from the top navigation.
2. The home footer links route directly into specific trust topics.
3. The help center covers:
   - getting started
   - customer booking flow
   - artisan onboarding
   - reviews and trust
   - payments and held funds
   - disputes and refunds
   - cancellations and rescheduling
   - artisan KYC standards
   - privacy and platform rules
   - support guidance

Result:

- the MVP now has a visible trust and policy layer instead of hiding key rules in operations only

---

## API Endpoints

## Users

Base path: `/users`

- `PATCH /users/role`
  Set the authenticated user role to `CUSTOMER` or `ARTISAN`.
  Public role changes are intentionally limited: artisan accounts cannot switch back to customer through this route, and admin roles are managed by admin tooling.
- `PATCH /users/fcm-token`
  Save or update the authenticated user's Firebase Cloud Messaging device token.
- `DELETE /users/fcm-token`
  Remove the authenticated user's stored Firebase Cloud Messaging device token.

## Authenticated utility

- `GET /me`
  Return the authenticated and database-synced user.
- `GET /protected`
  Simple token-protected test route.

## Categories

Base path: `/categories`

- `GET /categories`
  Public list of service categories.

## Artisans

Base path: `/artisans`

Public:

- `GET /artisans`
  Public artisan listing, with state, category, search, and sorting support.
- `GET /artisans/:id`
  Single artisan profile.
- `GET /artisans/:id/reviews`
  Public reviews for an artisan.
- `GET /artisans/:id/portfolio-images`
  Public portfolio images.
- `GET /artisans/:id/availability-slots`
  Public availability slots.

Authenticated artisan:

- `POST /artisans/profile`
  Create artisan profile.
- `PATCH /artisans/profile`
  Update artisan profile.
- `POST /artisans/portfolio-images/sign-upload`
  Create a signed Cloudinary upload payload for direct browser portfolio uploads.
- `POST /artisans/kyc/sign-upload`
  Signed Cloudinary upload for KYC document/selfie images (`bundo/artisan-kyc` folder).
- `GET /artisans/kyc`
  Fetch my current KYC submission.
- `POST /artisans/kyc`
  Create or update my KYC submission.
- `GET /artisans/me`
  Fetch my artisan profile.
- `GET /artisans/payout-account`
  Fetch stored payout account.
- `POST /artisans/payout-account`
  Create or update payout account.
- `GET /artisans/offerings`
  Legacy/deprecated artisan offerings route.
- `GET /artisans/portfolio-images/me`
  Get my portfolio images.
- `POST /artisans/portfolio-images`
  Add portfolio image.
- `PATCH /artisans/portfolio-images/:id`
  Update portfolio image.
- `DELETE /artisans/portfolio-images/:id`
  Delete portfolio image.
- `GET /artisans/availability-slots/me`
  Get my availability.
- `POST /artisans/availability-slots`
  Add availability slot.
- `PATCH /artisans/availability-slots/:id`
  Update availability slot.
- `DELETE /artisans/availability-slots/:id`
  Delete availability slot.

## Offerings

Base path: `/offerings`

- `GET /offerings`
  Public offerings list with search, category, price, state filtering, and sorting.
- `GET /offerings/:id`
  Single offering.
- `GET /offerings/me`
  Authenticated artisan offerings.
- `POST /offerings`
  Create offering for the authenticated artisan.
  Offerings can be prepared during onboarding, but public offering queries only expose offerings whose artisan profile is approved.
- `PATCH /offerings/:id`
  Update offering.
- `DELETE /offerings/:id`
  Delete offering.

## Bookings

Base path: `/bookings`

- `POST /bookings`
  Customer creates booking.
- `GET /bookings`
  Role-aware booking list.
- `GET /bookings/customer`
  Customer booking list.
- `GET /bookings/artisan`
  Artisan booking list.
- `GET /bookings/:id`
  Single booking for owner.
- `PATCH /bookings/:id/cancel`
  Customer cancels a requested or accepted booking.
- `PATCH /bookings/:id/reschedule`
  Customer or artisan moves a requested or accepted booking to a new future time. If availability slots exist, the new time must fit an active artisan window.
- `PATCH /bookings/:id/status`
  Artisan updates booking status: `ACCEPTED`, `ONGOING`, `DECLINED`, `COMPLETED`, or `CANCELLED`. Transitions are validated server-side; invalid moves return **409**.
- `POST /bookings/:id/dispute`
  Customer or artisan opens a dispute.

## Reviews

Base path: `/reviews`

- `POST /reviews`
  Customer creates review for completed booking.
- `GET /reviews/me`
  Customer reviews written by current user.

## Chat

Mounted at root.

- `POST /messages`
  Start message flow and create conversation if needed.
- `POST /messages/sign-upload`
  Create a signed Cloudinary upload payload for chat image attachments.
- `GET /conversations`
  List conversations for authenticated user.
- `POST /conversations/:id/messages`
  Reply in a conversation with text, an image attachment, or both.
- `GET /conversations/:id/messages`
  Fetch one conversation and its messages.

## Payments

Mounted at root.

- `GET /payments/banks`
  Authenticated list of supported Paystack transfer banks.
- `POST /payments/initialize`
  Customer initializes Paystack checkout for a booking.
- `GET /payments/:bookingId`
  Fetch booking payment for owner.
- `POST /payments/verify-reference`
  Verify and sync a Paystack payment reference for the current user. Returns **503** when Paystack is not configured and payment simulation is not allowed (see payment confirmation policy).
- `POST /webhooks/paystack`
  Paystack webhook endpoint (`charge.success` → mark payment `PAID_HELD`; `transfer.success` / `transfer.failed` / `transfer.reversed` → confirm or fail artisan payout).

## Notifications

Base path: `/notifications`

- `GET /notifications`
  Fetch the authenticated user's latest notifications.
- `PATCH /notifications/:id/read`
  Mark one notification as read.
- `PATCH /notifications/read-all`
  Mark all unread notifications as read.
- `POST /notifications/test`
  Trigger a test notification for the authenticated user and attempt browser push delivery if a device token exists.

## Health and observability

- `GET /health`
  Lightweight liveness check.
- `GET /ready`
  Readiness check with database ping.

## Admin

Base path: `/admin`

Users:

- `GET /admin/users`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/role`

Artisans:

- `GET /admin/artisans`
- `GET /admin/artisans/:id`
- `PATCH /admin/artisans/:id/verify`
- `GET /admin/kyc-submissions`
- `GET /admin/kyc-submissions/:id`
- `PATCH /admin/kyc-submissions/:id/review`

Categories:

- `GET /admin/categories`
- `POST /admin/categories`
- `PATCH /admin/categories/:id`
- `DELETE /admin/categories/:id`

Bookings and payments:

- `GET /admin/bookings`
  List bookings with `conversationId` and optional `moderator` user. Pagination default limit **100**, max **200** per page. Optional query: `?stage=requests|appointments|ongoing|completed`, `?moderatorId=<firebaseUid|unassigned>`.
- `GET /admin/bookings/:id`
  Single booking with `conversationId`.
- `PATCH /admin/bookings/:id/status`
  Admin lifecycle: `ACCEPTED`, `ONGOING`, `COMPLETED`, or `CANCELLED` (validated transitions).
- `PATCH /admin/bookings/:id/moderator`
  Body: `{ "moderatorId": "<firebaseUid>" | null }`. Assigns an active `ADMIN` user to moderate the job, or clears assignment.
- `POST /admin/bookings/:id/release-payment`
- `POST /admin/disputes/:id/resolve`

Conversations:

- `GET /admin/conversations`
- `GET /admin/conversations/:id`
- `GET /admin/conversations/:id/messages`
- `POST /admin/conversations/:id/messages`
  Send an admin-authored support reply with text, image attachment, or both into the customer-artisan conversation.
- `POST /admin/conversations/:id/notes`
  Store a private internal admin note on the conversation.

Reviews:

- `GET /admin/reviews`
- `DELETE /admin/reviews/:id`

Ledger:

- `GET /admin/ledger-entries`
  Recent ledger rows for settlement audit (paginated).

Stats:

- `GET /admin/stats`
  Includes aggregate counts plus `bookingRequests`, `bookingAppointments`, `bookingOngoing`, and `bookingCompleted`.

---

## Payment Status Meanings

- `UNPAID`
  Payment record exists or booking exists, but no confirmed payment yet.
- `PAYMENT_PENDING`
  Checkout initialized, waiting for customer to complete payment.
- `PAID_HELD`
  Payment confirmed and held by Bundo pending service completion.
- `PARTIALLY_REFUNDED`
  Part of the payment was returned to the customer.
- `PARTIALLY_RELEASED`
  Reserved for split payout scenarios.
- `RELEASED`
  Provider payout has been sent.
- `REFUNDED`
  Payment has been fully refunded.
- `FAILED`
  Verification failed or transaction did not complete successfully.

---

## Smart Local Paystack Testing

For local development, Bundo supports **Paystack-backed** confirmation (webhook or verify-reference), plus an optional **non-production simulation** path when Paystack keys are absent (see above).

### Local simulation without Paystack keys

If you only need the workspace to show **`PAID_HELD`** after a fake checkout (no real money), in **non-production** you can set `ALLOW_PAYMENT_SIMULATION=true` in `server/.env`. The server logs a warning whenever it confirms a payment without calling Paystack. **Never** enable this in production.

### Webhook path

Best for real-world behavior:

1. expose local API with a tunnel like `ngrok`
2. point Paystack webhook to `/webhooks/paystack`
3. complete a checkout
4. webhook marks payment as `PAID_HELD`

### Local callback verification path

Best for local dev without public webhook:

1. Paystack redirects back to frontend callback URL
2. frontend detects `reference` or `trxref` in the URL
3. frontend calls `POST /payments/verify-reference`
4. backend verifies the payment directly with Paystack
5. frontend refreshes workspace bookings

Paystack callback and notification links use path routes, for example:

- `http://localhost:5173/workspace/bookings`

Set `PAYSTACK_CALLBACK_URL` in server env to your deployed origin + `/workspace/bookings` (see `server/.env.example` and `client/.env.production.example`).

For local development, the API now accepts both:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

For production and web-mobile testing, the API accepts explicitly configured `CORS_ORIGIN` entries and Vercel deployment subdomains ending in `.vercel.app`. This keeps production and preview deployments usable after email verification redirects or Vercel preview testing.

---

## Frontend Push Setup

To fully enable browser push alerts in local or production environments:

1. Add `VITE_FIREBASE_VAPID_KEY` to the frontend environment.
2. Start the frontend with the Firebase config values present.
3. Sign in and open the notifications workspace.
4. Click `Enable push alerts`.
5. The browser token is saved through `/users/fcm-token`.
6. Foreground messages refresh the in-app feed, and background messages route users to workspace notifications.

Reference environment template:

- [client/.env.example](/Users/macbook/bundo/client/.env.example)

---

## Email verification and deliverability

Signup and login use **Firebase Authentication** for verification and password-reset emails (not a custom Bundo SMTP server).

**In-app behavior:**

- [sendBundoEmailVerification](/Users/macbook/bundo/client/src/lib/authEmailVerification.ts) wraps `sendEmailVerification` with `actionCodeSettings.url` set to `window.location.origin + '/'`.
- [EmailInboxHint](/Users/macbook/bundo/client/src/components/EmailInboxHint.tsx) is shown on the verification step in [AuthBox.tsx](/Users/macbook/bundo/client/src/auth/AuthBox.tsx) (and alternate auth pages) telling users to check spam/junk and mark as “Not spam”.
- Success toasts mention **inbox and spam folder** for verification resend and password reset.

**Improving inbox placement (Firebase Console — recommended for production):**

1. **Authentication → Settings → Authorized domains** — include production and preview domains.
2. **Authentication → Templates** — customize verification email subject/body and sender display name.
3. **Custom domain for auth emails** (best) — configure SPF/DKIM per Firebase/Google instructions so mail is not sent only from `noreply@<project>.firebaseapp.com`.

The app cannot fully prevent spam filtering without Firebase/domain configuration; the inbox hint is the fallback UX.

---

## Pagination limits (admin API)

[utils/pagination.ts](/Users/macbook/bundo/server/src/utils/pagination.ts) accepts an optional `maxLimit` per route:

| Route | Default limit | Max limit |
|-------|---------------|-----------|
| `GET /admin/bookings` | 100 | 200 |
| `GET /admin/users` | 50 | 100 |
| Most other admin lists | 20 | 50 |

`App.tsx` loads admin bookings with `limit=200` and tracks `adminBookingsTotal` from response `meta.total` for the jobs panel header.

---

## Legacy / unused frontend paths

The live app mounts [AppRoutes.tsx](/Users/macbook/bundo/client/src/app/AppRoutes.tsx) from [App.tsx](/Users/macbook/bundo/client/src/App.tsx).

**Removed (May 2026):** `LandingPage.tsx`, `AppRouter.tsx`, mock `pages/customer/Dashboard.tsx`, empty `pages/artisan/Dashboard.tsx`, and legacy `features/artisan/ArtisanPanel.tsx` (unused monolith; workspace uses `ArtisanOffersPanel` + `ArtisanProfileSettings`). Auth pages use [AuthMarketingBackdrop.tsx](/Users/macbook/bundo/client/src/components/AuthMarketingBackdrop.tsx) instead of the old landing monolith.

**Deprecated barrel (do not add code):** [appShellComponents.tsx](/Users/macbook/bundo/client/src/app/appShellComponents.tsx) re-exports `features/*` for older imports only.

Prefer editing modular files under `client/src/features/`, `client/src/admin/`, `client/src/views/`, `client/src/panels/`, and `client/src/auth/`. See [client/ARCHITECTURE.md](/Users/macbook/bundo/client/ARCHITECTURE.md) for the route map and folder conventions.

**Verification after client refactors:** run `npm run build` in `client/` (TypeScript + Vite). Server unit tests: `npm test` in `server/`. CI also runs the lifecycle smoke job against Postgres when configured.

---

## Current Strengths

- clean role-based access control
- good separation between modules
- public discovery plus private workspaces
- signup flow separates client and artisan intent before account creation
- artisan onboarding now follows a guided 4-step setup flow
- unapproved artisan offerings are hidden from public discovery until admin approval
- approved artisans use `/workspace` with dashboard, jobs, messages, reviews, offers, notifications, and profile settings (photos in Profile)
- artisan refresh restore now lands in the workspace instead of reopening onboarding from a stale saved route
- marketplace payment structure already modeled correctly
- production fail-closed payment confirmation when Paystack is not configured; optional `ALLOW_PAYMENT_SIMULATION` for non-production demos only
- admin visibility into operations
- conversation moderation support
- rating system tied to real bookings
- local fallback for Paystack payment verification
- persistent in-app notifications with backend push-delivery support
- booking rescheduling with ownership and availability checks
- artisan KYC submission and admin review workflow
- KYC flow validated end to end across artisan and admin roles
- richer marketplace filtering and sorting for discovery
- direct browser portfolio uploads through signed Cloudinary uploads (optional in onboarding; full management in Profile)
- optional portfolio during onboarding and upload while pending approval (Option C)
- artisan workspace header with full section navigation on desktop and mobile
- admin jobs queue with inline rows, mobile drawer nav, and per-booking moderator assignment
- email verification UX with spam-folder guidance and site-origin continue URLs
- request-id aware health and readiness endpoints for observability
- Vitest unit tests for payment confirmation policy and Paystack signing helpers; GitHub Actions CI builds client and server (see [.github/workflows/ci.yml](/Users/macbook/bundo/.github/workflows/ci.yml))

---

## Build, test, and database

From the repo root:

```bash
npm run build          # tsc server + tsc/vite client
npm test               # server Vitest suite
npm run db:migrate     # prisma migrate dev (local)
```

From `server/`:

```bash
npm run db:migrate:deploy   # apply migrations in staging/production
npm run db:migrate:deploy:pooler   # same, but DIRECT_URL = DATABASE_URL with port 5432 (Supabase session pooler)
```

**Migrations and `DIRECT_URL`:** Prisma uses `DIRECT_URL` when set (see [prisma.config.ts](/Users/macbook/bundo/server/prisma.config.ts)), otherwise `DATABASE_URL`. Supabase **direct** hosts (`db.<ref>.supabase.co`) must resolve in DNS; if not, use the **session pooler** on port **5432** as `DIRECT_URL` for `migrate deploy`. The app runtime can keep using the transaction pooler on port **6543** for `DATABASE_URL`.

**Client production deploy:** [client/vercel.json](/Users/macbook/bundo/client/vercel.json) rewrites all paths to `index.html` for SPA routing.

**Lifecycle API smoke test (optional, needs `server/.env` + DB):**

```bash
npm run test:smoke
```

---

## Production deployment

**Live URLs (current):**

| Service | URL |
|---------|-----|
| Web (Vercel) | https://bundo-service-marketplace.vercel.app |
| API (Render) | https://bundo-service-marketplace.onrender.com |

Typical layout for Bundo today:

| Piece | Where | Notes |
|-------|--------|--------|
| **Web app** | Vercel (or similar) from `client/` | Set `VITE_*` env vars; root directory `client`; build `npm run build`; output `dist`. SPA rewrites in `vercel.json`. |
| **API** | Node host (Railway, Render, Fly, VPS, etc.) from `server/` | `npm run build` → `npm start`; set all `server/.env` vars including `CORS_ORIGIN` (production web origin), Paystack keys, Firebase Admin, Cloudinary, `DATABASE_URL`. |
| **Database** | Supabase PostgreSQL | Run `npm run db:migrate:deploy` in `server/` after each release that adds migrations. Use session pooler `:5432` for `DIRECT_URL` if the direct host does not resolve. |

**After pushing to `main`:**

1. Confirm [GitHub Actions CI](https://github.com/BUNDO-TECH-LLC/bundo-service-marketplace/actions) is green (build + tests in `server/` and `client/`).
2. **Database:** apply migrations on production (`db:migrate:deploy`) before or immediately after API deploy. Recent migrations include:
   - `20260516120000_add_booking_ongoing_status` — `ONGOING` on `BookingStatus`
   - `20260519120000_add_booking_moderator` — optional `bookings.moderator_id` → `users.firebase_uid` for admin job ownership
   If `migrate deploy` fails with Prisma `P1001` on `db.<ref>.supabase.co`, set `DIRECT_URL` to the Supabase **session pooler** hostname on port **5432** (keep transaction pooler on **6543** for `DATABASE_URL` at runtime).
3. **API:** redeploy or restart so the new build is live; verify `GET /health` and `GET /ready`.
4. **Web:** Vercel (if connected to the repo) usually auto-deploys `client/` on push; confirm `VITE_API_BASE_URL` points at the live API.
5. **Paystack:** `PAYSTACK_CALLBACK_URL` must be **`https://`** in production (e.g. `https://bundo-service-marketplace.vercel.app/workspace/bookings`). A localhost callback will make Render **build succeed but crash on start** with a Zod validation error.

Templates: [client/.env.production.example](/Users/macbook/bundo/client/.env.production.example), [server/.env.production.example](/Users/macbook/bundo/server/.env.production.example).

---

## Automated tests and CI

- **Vitest** runs from `server/` with `npm test` (see [vitest.config.ts](/Users/macbook/bundo/server/vitest.config.ts)). Test files live next to modules as `*.test.ts` and are excluded from the production TypeScript build output.
- **Policy tests** cover [paymentConfirmPolicy.ts](/Users/macbook/bundo/server/src/modules/payments/paymentConfirmPolicy.ts) so production vs simulation rules cannot regress silently.
- **Booking transition tests** cover [bookingStatus.ts](/Users/macbook/bundo/server/src/lib/bookingStatus.ts).
- **Payment guard tests** cover [bookingPayment.ts](/Users/macbook/bundo/server/src/lib/bookingPayment.ts).
- **E2E smoke** ([smoke.lifecycle.e2e.test.ts](/Users/macbook/bundo/server/src/smoke.lifecycle.e2e.test.ts)): booking lifecycle, admin jobs, and chat — run with `BUNDO_E2E=1` / `npm run test:smoke` (requires `DATABASE_URL` + migrated schema).
- **CI** (`.github/workflows/ci.yml`): three jobs on `main` — `server` (unit tests + build), `client` (build), `smoke` (Postgres + `migrate deploy` + lifecycle e2e). CI Postgres URLs use `sslmode=disable` for the service container.

---

## Launch readiness checklist

Use this before calling the product **publicly launched**. Items marked **Blocker** should be done first.

### Blockers (must complete)

- [ ] **Paystack live test** — Real customer payment → `PAID_HELD` → job completion → artisan payout (or admin release) on production API keys
- [ ] **Paystack webhooks** — Dashboard webhook URL → `https://bundo-service-marketplace.onrender.com/webhooks/paystack`; verify `charge.success` and transfer events update DB
- [ ] **`PAYSTACK_CALLBACK_URL`** — Must be `https://bundo-service-marketplace.vercel.app/workspace/bookings` (or your canonical web origin)
- [ ] **Production env audit** — `CORS_ORIGIN`, `VITE_API_BASE_URL`, Firebase authorized domains, Cloudinary, Firebase Admin on Render
- [ ] **DB migrations** — `cd server && npm run db:migrate:deploy:pooler` on production after each release
- [ ] **Manual QA script** — Customer: signup → verify email → browse → book → pay → message → review. Artisan: onboarding → KYC → admin approve → accept job → complete. Admin: KYC, job lifecycle, payout/dispute
- [ ] **Firebase authorized domains** — Include production + preview Vercel URLs for auth and password reset emails

### High priority (strongly recommended)

- [ ] **Stabilize CI smoke** — Green `smoke` job on every `main` push (investigate GitHub-only e2e failures if migrate passes)
- [x] **Google sign-in on `/login`** — `lib/authSessionFlow.ts` + `AuthPage` (May 2026)
- [x] **Legal / trust pages** — `/terms`, `/privacy` (`LegalPage.tsx`, `legalContent.ts`); footer + signup + drawer links
- [ ] **Support contact** — Monitored `support@bundo.ng` (constant in `client/src/constants/support.ts`); wire in Help footer if not already
- [ ] **Firebase email domain** — Custom domain + templates for verification and reset (reduce spam folder)
- [ ] **Error monitoring** — Sentry or similar on client + server
- [ ] **Uptime alerting** — Ping `/health` and `/ready` (e.g. Better Uptime, Render/Vercel notifications)

### Medium priority (post-launch or parallel)

- [x] Search ranking by distance (`sort=distance` + lat/lng)
- [x] Notification preferences UI (Account settings + server enforcement)
- [x] Editable phone (`PATCH /users/phone`)
- [ ] E2E payment smoke in CI (Paystack test mode or mocked)
- [ ] Remove deprecated `appShellComponents.tsx` barrel when no imports remain
- [ ] Client Vitest for critical routes (login, marketplace, workspace guards)

### Already done (reference)

<details>
<summary>Core product (shipped)</summary>

- Firebase auth, roles, email verification, password reset page (`/forgot-password`)
- 4-step artisan onboarding, KYC upload, admin approval, artisan workspace
- Bookings lifecycle, chat, reviews, Paystack held payments, disputes, admin ledger
- Admin jobs queue, moderator assign, mobile admin nav, portfolio gallery in KYC review
- Client feature-based architecture, dedicated auth routes, production deploy pipeline
- Account settings hub, delete account API, Terms/Privacy routes, auth drawer stability, signed-in icon topbar
</details>

---

## Pre-launch manual QA checklist (printable)

Run on **production** (Vercel + Render) after each release. Check boxes when pass; note failures in your issue tracker.

### Guest & marketing

- [ ] Home loads; marketplace link works
- [ ] Footer **Terms** → `/terms`, **Privacy** → `/privacy`
- [ ] Help center topics open; no console errors

### Auth (customer)

- [ ] Header **Log in** opens drawer (page does not freeze)
- [ ] Email signup → verification email → `/verify-email` flow
- [ ] `/login` and `/signup` pages work; Google sign-in completes role if new user
- [ ] Forgot password email → reset → sign in at `/login`
- [ ] Signup shows Terms/Privacy links

### Auth (artisan)

- [ ] Artisan signup from drawer or `/signup?role=artisan`
- [ ] Onboarding steps; terms checkbox links to `/terms` and `/privacy`
- [ ] Pending approval screen after submit; logout works

### Customer workspace

- [ ] Browse marketplace, open artisan profile, create booking
- [ ] Paystack test payment → booking shows paid / held state
- [ ] Messages send/receive; image upload if used
- [ ] Complete job → leave review
- [ ] **Settings** (`/workspace/settings`): phone save, notification toggles, password reset email, language preference persists

### Artisan workspace

- [ ] Dashboard, jobs list, accept → start → complete lifecycle
- [ ] Profile: photos, KYC, bank, availability
- [ ] Settings (personal + business link to profile)

### Admin

- [ ] KYC approve/reject; artisan appears on marketplace when approved
- [ ] Jobs queue: assign moderator, lifecycle actions, inline chat
- [ ] Finance / disputes visible for test booking

### Account deletion (staging or test user only)

- [ ] Settings → Delete account → type `DELETE` → signed out; cannot sign in with same email without new signup

### Mobile (375px width)

- [ ] Topbar icon nav + tooltips; Help only in account menu
- [ ] Settings: pill nav, one panel at a time, full-width actions
- [ ] Auth drawer scrolls; signup legal text readable

---

## MVP Readiness Checklist (historical)

### Core marketplace flow

- [x] Firebase authentication
- [x] Signup role selection for customer and artisan
- [x] Email verification for email/password signup
- [x] Password reset by Firebase email (dedicated `/forgot-password` page; May 2026)
- [x] Google sign-in with role completion for new users (header `AuthBox` drawer + `/login` / `/signup` via `authSessionFlow`)
- [x] Artisan profile creation
- [x] 4-step artisan onboarding flow
- [x] Public artisan discovery
- [x] Offerings and categories
- [x] Booking creation and lifecycle (`REQUESTED` → `ACCEPTED` → `ONGOING` → `COMPLETED`)
- [x] Server-enforced booking status transitions (artisan + admin)
- [x] Artisan jobs list and booking detail flow (accept, start service, complete)
- [x] Admin jobs queue with appointments, lifecycle actions, and per-job chat
- [x] Customer reviews on completed bookings (UI + `POST /reviews`)
- [x] Paystack payment required before service start or job completion (server + UI)
- [x] Artisan post-submit awaiting-approval screen with logout
- [x] Basic rescheduling flow
- [x] Chat between customer and artisan
- [x] Chat image attachments for customers, artisans, and admin support
- [x] Reviews tied to completed jobs
- [x] Artisan reviews dashboard

### Marketplace operations

- [x] Admin control center
- [x] Artisan approval and verification status
- [x] Artisan KYC submission and admin review validated end to end
- [x] KYC approval syncs artisan public approval state
- [x] Dispute handling
- [x] Held payments and payout release
- [x] In-app notifications
- [x] Browser push notification support
- [x] Help-center and trust-policy content
- [x] Search and sorting filters for public marketplace discovery
- [x] Direct browser media upload flow for artisan portfolio (optional onboarding; Profile is canonical photo home)
- [x] Artisan profile/settings surface with Photos / KYC / Bank sections
- [x] Artisan workspace header navigation (Dashboard through Profile)
- [x] Admin mobile-friendly console (drawer nav, inline job/profile/KYC rows)
- [x] Admin job moderator assignment per booking
- [x] Email verification spam-folder guidance in signup UI
- [x] Basic production observability with health, readiness, request IDs, and structured request logging
- [x] Server unit tests for payment confirmation policy, booking transitions, and CI build pipeline
- [x] React Router path-based navigation and notification deep links
- [x] Central API error handling (`AppError` + `asyncHandler`)

### Still needed before a stronger public MVP launch

See **[Launch readiness checklist](#launch-readiness-checklist)** above for the canonical pre-launch list. Summary of open items:

- [ ] Production Paystack webhook + real-money settlement test (**blocker**)
- [ ] Confirm transfer webhooks in Paystack dashboard (`PROCESSING` → `SENT` / `FAILED`)
- [ ] CI smoke e2e consistently green on GitHub
- [ ] Apple Sign In (not implemented)
- [ ] Observability/alerting on production
- [x] Search ranking (distance), notification prefs, editable phone, Terms/Privacy, account settings hub
- [ ] Firebase custom domain for auth emails (see [Email verification and deliverability](#email-verification-and-deliverability))

---

## Current Gaps and Future Upgrades

The project is strong for MVP, but these are sensible next expansions:

1. production confirmation of Paystack transfer webhooks and payout `PROCESSING` → `SENT` lifecycle
2. richer refund and payout audit trail entities beyond ledger list view
3. richer scheduling windows and negotiated rescheduling flow (basic modal reschedule shipped)
4. search ranking and recommendation quality by price/rating/distance
5. production observability, alerting, and background job handling
6. notification preferences and editable phone in artisan profile
7. Firebase custom sending domain for auth emails (reduce spam-folder rate)
8. E2E **payment** smoke in CI (Paystack; lifecycle smoke already runs in CI)

---

## Recommended Ongoing Build Order

The smartest order from here is:

1. **Launch blockers** — Paystack webhooks + live payment/payout test on production
2. **Manual QA + Firebase domains** — Full role walkthrough; authorized domains + reset/verify emails
3. **CI smoke green** — Fix intermittent GitHub e2e if still failing after SSL migrate fix
4. **Auth polish** — Google on `/login` or remove stubs; custom email domain
5. **Observability** — Sentry + uptime alerts on `/health`
6. **Post-launch** — Search ranking, notification prefs, editable phone

---

## Key Files to Know First

If someone new joins the project, these are the best first reads:

- [README.md](/Users/macbook/bundo/README.md) (how to run the repo)
- [src/server.ts](/Users/macbook/bundo/server/src/server.ts)
- [prisma/schema.prisma](/Users/macbook/bundo/server/prisma/schema.prisma)
- [src/modules/payments/paymentConfirmPolicy.ts](/Users/macbook/bundo/server/src/modules/payments/paymentConfirmPolicy.ts)
- [src/modules/payments/payments.service.ts](/Users/macbook/bundo/server/src/modules/payments/payments.service.ts)
- [src/modules/admin/admin.routes.ts](/Users/macbook/bundo/server/src/modules/admin/admin.routes.ts)
- [src/modules/bookings/bookings.routes.ts](/Users/macbook/bundo/server/src/modules/bookings/bookings.routes.ts)
- [src/modules/artisans/artisans.routes.ts](/Users/macbook/bundo/server/src/modules/artisans/artisans.routes.ts)
- [client/src/app/AppRoutes.tsx](/Users/macbook/bundo/client/src/app/AppRoutes.tsx)
- [client/src/lib/appPaths.ts](/Users/macbook/bundo/client/src/lib/appPaths.ts)
- [client/src/App.tsx](/Users/macbook/bundo/client/src/App.tsx)
- [client/ARCHITECTURE.md](/Users/macbook/bundo/client/ARCHITECTURE.md)
- [client/src/app/AppProvider.tsx](/Users/macbook/bundo/client/src/app/AppProvider.tsx)
- [client/src/pages/auth/ForgotPassword.tsx](/Users/macbook/bundo/client/src/pages/auth/ForgotPassword.tsx)
- [server/src/lib/bookingStatus.ts](/Users/macbook/bundo/server/src/lib/bookingStatus.ts)
- [server/src/lib/bookingConversations.ts](/Users/macbook/bundo/server/src/lib/bookingConversations.ts)
- [client/src/lib/api.ts](/Users/macbook/bundo/client/src/lib/api.ts)
- [client/src/lib/formatting.ts](/Users/macbook/bundo/client/src/lib/formatting.ts)
- [client/src/appTypes.ts](/Users/macbook/bundo/client/src/appTypes.ts) (`ArtisanHeaderActive`, `WorkspaceSection`, admin record types)
- [client/src/lib/authEmailVerification.ts](/Users/macbook/bundo/client/src/lib/authEmailVerification.ts)
- [client/src/lib/portfolioUpload.ts](/Users/macbook/bundo/client/src/lib/portfolioUpload.ts)
- [client/src/panels/BookingsPanel.tsx](/Users/macbook/bundo/client/src/panels/BookingsPanel.tsx)
- [client/src/types.ts](/Users/macbook/bundo/client/src/types.ts)
