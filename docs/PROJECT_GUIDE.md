# Bundo Project Guide

## What Bundo Is

Bundo is a service marketplace that connects customers with artisans. The current product supports:

- Firebase-authenticated users
- Signup role selection for `CUSTOMER` and `ARTISAN`, with `ADMIN` managed through admin tools
- Public artisan discovery
- 4-step artisan profile onboarding
- Artisan KYC submission and admin review
- Category-based offerings
- Booking requests
- Artisan jobs dashboard, request handling, active bookings, profile settings, and reviews
- Direct chat between customer and artisan, with image attachments
- Reviews for completed jobs
- In-app notifications
- Push-ready notification delivery through Firebase Cloud Messaging token storage
- Admin moderation
- Marketplace-style payments through Paystack
- Held funds, disputes, and admin-controlled payout release

The frontend lives in `client/`, the backend API lives in `server/src/`, and the Prisma/database assets live in `server/prisma/`.

Current launch-oriented structure:

- `client/` for the React/Vite frontend
- `server/` for the Express API, Prisma schema, migrations, and backend environment files
- `docs/` for operational and product documentation
- root `package.json` as the shared entrypoint for running both sides cleanly

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
- complete a 4-step onboarding flow for basic info, services/pricing, portfolio, and availability
- create an artisan profile
- create service packages under categories during onboarding
- upload portfolio and availability data
- receive booking requests
- accept, decline, and complete bookings
- message customers
- configure a payout bank account
- submit KYC identity details for review
- use artisan dashboard surfaces for jobs, reviews, and profile settings

### Admin

An admin can:

- review platform stats
- manage users and roles
- approve or reject artisan verification
- review artisan KYC submissions
- manage categories
- inspect bookings
- inspect conversations, reply as Bundo support with text or images, and write internal admin notes
- moderate reviews
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

---

## Database Model Summary

The Prisma schema is here:

- [prisma/schema.prisma](/Users/macbook/bundo/server/prisma/schema.prisma)

Main business entities:

- `User`
- `ArtisanProfile`
- `Category`
- `Offering`
- `Booking`
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

The main frontend entrypoint is:

- [client/src/App.tsx](/Users/macbook/bundo/client/src/App.tsx)

Supporting client files:

- API helper:
  [client/src/lib/api.ts](/Users/macbook/bundo/client/src/lib/api.ts)
- Firebase web config:
  [client/src/lib/firebase.ts](/Users/macbook/bundo/client/src/lib/firebase.ts)
- Firebase web push helper:
  [client/src/lib/messaging.ts](/Users/macbook/bundo/client/src/lib/messaging.ts)
- Shared frontend types:
  [client/src/types.ts](/Users/macbook/bundo/client/src/types.ts)
- Global styling:
  [client/src/styles.css](/Users/macbook/bundo/client/src/styles.css)
- Firebase messaging service worker:
  [client/public/firebase-messaging-sw.js](/Users/macbook/bundo/client/public/firebase-messaging-sw.js)

The current frontend is a single-page React app that manages:

- home/landing experience
- discovery and artisan profile viewing
- workspace by role
- signup role choice for client or artisan
- logged-in customer dashboard
- 4-step artisan onboarding wizard
- approved-artisan dashboard with jobs, active booking detail, reviews, and profile settings
- artisan setup uses a simple sticky Bundo setup header and does not show dashboard navigation before approval
- approved artisan dashboard screens switch to a single artisan-specific header; the global marketplace header is hidden there to avoid duplicate navigation
- chat with photo attachments
- bookings
- a dedicated admin operations console with its own navigation for overview, profiles, jobs, messages, verification, and catalog; admin sessions do not show the customer/artisan marketplace navbar
- payment actions in the booking flow
- help-center and trust-policy content for payments, disputes, cancellations, KYC, privacy, and support

---

## End-to-End Product Flows

## 1. Authentication and user bootstrap

1. User signs up or logs in with Firebase on the frontend.
2. Signup asks the user to choose client or artisan before account creation.
3. User can continue with Google or email/name/password. Email signup requires a standard password and verify-password confirmation before the Firebase account is created.
4. Email/password signup sends a Firebase email verification link before the user is synced into the Bundo backend.
5. Unverified email/password users stay on the verification screen and can resend the verification email or confirm after clicking the email link.
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
- password reset stays with Firebase Auth email templates
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
5. Step 3, Portfolio:
   - signs direct upload through `/artisans/portfolio-images/sign-upload`
   - uploads one or more images to Cloudinary from the browser
   - stores portfolio image metadata through `/artisans/portfolio-images`
   - requires a valid backend `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; local E2E testing currently reaches Cloudinary but fails with an invalid configured cloud name
6. Step 4, Availability and submit:
   - saves availability through `/artisans/availability-slots`
   - submits KYC through `/artisans/kyc`
7. Admin reviews KYC and profile status.

Result:

- artisan profile and service setup are collected before public launch
- artisan becomes discoverable only after KYC/admin approval
- offerings created during onboarding stay hidden from public marketplace until the artisan is approved
- artisan is ready for payouts

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

## 2C. Approved artisan workspace

After KYC/admin approval, the artisan home becomes an operations dashboard:

1. Dashboard is the default approved-artisan landing page and shows booking totals, rating summary, active jobs, new requests, weekly summary, availability, quick links, and a simple approval badge.
2. Jobs tab shows active bookings with filters for all, pending, accepted, completed, and declined.
3. Selecting a job opens the booking detail screen:
   - customer details
   - service, date, time, note, and status
   - request accept/decline for pending jobs
   - mark completed for accepted jobs
   - open chat
4. Messages tab opens the shared conversation UI.
5. Reviews tab shows rating summary, rating bars, and review cards from completed bookings.
6. Service offers tab is limited to offer creation and existing offer review; sensitive verification and payout details are not shown there.
7. Profile/settings contains personal profile controls, KYC verification status and fields, bank/payout information, and links to business info, job history, service/pricing, settings, and notifications.

Result:

- artisans have a role-specific workspace rather than using the customer dashboard
- approved artisans land on dashboard, not KYC or setup screens
- sensitive KYC and bank details live in profile settings rather than the main dashboard or service-offer page
- booking lifecycle actions stay connected to `/bookings/:id/status`
- chat and reviews stay connected to the shared backend modules

## 3. Customer discovery and booking

1. Customer browses `/artisans` and `/offerings`.
2. Customer opens one artisan profile.
3. Customer creates a booking for an offering.
4. Booking starts in `REQUESTED`.
5. Backend creates or updates the customer-artisan conversation and inserts an automatic booking message.
6. Frontend shows a booking success confirmation with actions to go directly to messages or continue browsing while the request stays active.
7. Artisan accepts or declines.
8. Customer or artisan can reschedule while the booking is still `REQUESTED` or `ACCEPTED`.
9. If accepted, customer can chat and pay.

Result:

- booking connects customer, artisan, and offering
- every opened job has a standard message thread in both inboxes
- customers get a clear success state instead of only a toast notification

## 4. Marketplace payment flow

1. Customer opens a booking and clicks `Pay securely`.
2. Frontend calls `POST /payments/initialize`.
3. Backend creates or reuses a `Payment`.
4. Backend calls Paystack transaction initialize.
5. Frontend receives Paystack hosted checkout URL and redirects.
6. After payment, one of two things confirms the transaction:
   - Paystack webhook calls `/webhooks/paystack`
   - local callback flow calls `POST /payments/verify-reference`
7. Backend verifies the Paystack transaction and marks payment as `PAID_HELD`.
8. Ledger entries are created for:
   - customer payment
   - platform fee
   - provider earning

Result:

- funds are treated as held by the marketplace
- payout is not auto-sent to artisan

## 5. Completion and payout release

1. Artisan completes the booking.
2. Payment remains held.
3. Admin reviews the booking state.
4. Admin triggers payout release.
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

1. Customer completes a booking.
2. Customer posts a review tied to that booking.
3. Backend prevents duplicate booking reviews.
4. Artisan average rating and rating count are recalculated.

Result:

- artisan trust score improves discovery quality

## 8. Messaging

1. Customer starts a conversation by sending a message.
2. Backend finds or creates the conversation.
3. Artisan replies in the same thread.
4. Customer, artisan, and admin support replies can include a message body, an image attachment, or both.
5. Image attachments are signed by the backend and uploaded directly to Cloudinary from the browser.
6. Admin can inspect conversations and attach internal notes.

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
- booking accepted, declined, or completed
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
  Artisan updates booking status. Current artisan UI uses this for request accept/decline and marking accepted jobs completed.
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
  Verify and sync a Paystack payment reference for the current user.
- `POST /webhooks/paystack`
  Paystack webhook endpoint.

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
- `GET /admin/bookings/:id`
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

Stats:

- `GET /admin/stats`

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

For local development, Bundo now supports two useful paths:

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

This is why the callback URL is configured as:

- `http://localhost:5173/?view=workspace&section=bookings`

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

## Current Strengths

- clean role-based access control
- good separation between modules
- public discovery plus private workspaces
- signup flow separates client and artisan intent before account creation
- artisan onboarding now follows a guided 4-step setup flow
- unapproved artisan offerings are hidden from public discovery until admin approval
- approved artisans have dedicated dashboard, jobs, reviews, and profile settings surfaces
- artisan refresh restore now lands in the workspace instead of reopening onboarding from a stale saved route
- marketplace payment structure already modeled correctly
- admin visibility into operations
- conversation moderation support
- rating system tied to real bookings
- local fallback for Paystack payment verification
- persistent in-app notifications with backend push-delivery support
- booking rescheduling with ownership and availability checks
- artisan KYC submission and admin review workflow
- KYC flow validated end to end across artisan and admin roles
- richer marketplace filtering and sorting for discovery
- direct browser portfolio uploads through signed Cloudinary uploads
- request-id aware health and readiness endpoints for observability

---

## MVP Readiness Checklist

### Core marketplace flow

- [x] Firebase authentication
- [x] Signup role selection for customer and artisan
- [x] Email verification for email/password signup
- [x] Password reset by Firebase email
- [x] Google sign-in with role completion for new users
- [x] Artisan profile creation
- [x] 4-step artisan onboarding flow
- [x] Public artisan discovery
- [x] Offerings and categories
- [x] Booking creation and lifecycle
- [x] Artisan jobs list and booking detail flow
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
- [x] Direct browser media upload flow for artisan portfolio
- [x] Artisan profile/settings surface
- [x] Basic production observability with health, readiness, request IDs, and structured request logging

### Still needed before a stronger public MVP launch

- [ ] Production webhook exposure and confirmed end-to-end Paystack settlement testing
- [ ] Stronger payout audit and settlement reconciliation
- [ ] Search ranking tuned with distance and recommendation signals
- [ ] Production observability and alerting beyond basic health checks
- [ ] Richer media management for artisan portfolio editing, image replacement, and reordering
- [ ] Deeper artisan profile settings for business information, pricing edits, and notification preferences

---

## Current Gaps and Future Upgrades

The project is strong for MVP, but these are sensible next expansions:

1. transfer success webhook handling for payout settlement confirmation
2. richer refund and payout audit trail entities
3. richer scheduling windows and negotiated rescheduling flow
4. search ranking and recommendation quality by price/rating/distance
5. richer cloud media management for artisan portfolio
6. production observability, alerting, and background job handling
7. full artisan settings modules beyond the first profile-settings screen

---

## Recommended Ongoing Build Order

The smartest order from here is:

1. Production-grade webhook exposure and Paystack dashboard setup
2. Full real payment + refund + payout acceptance test
3. Better scheduling and negotiated rescheduling polish
4. Search relevance and marketplace ranking
5. Portfolio and profile management polish
6. Production alerting and support tooling

---

## Key Files to Know First

If someone new joins the project, these are the best first reads:

- [src/server.ts](/Users/macbook/bundo/server/src/server.ts)
- [prisma/schema.prisma](/Users/macbook/bundo/server/prisma/schema.prisma)
- [src/modules/payments/payments.service.ts](/Users/macbook/bundo/server/src/modules/payments/payments.service.ts)
- [src/modules/admin/admin.routes.ts](/Users/macbook/bundo/server/src/modules/admin/admin.routes.ts)
- [src/modules/bookings/bookings.routes.ts](/Users/macbook/bundo/server/src/modules/bookings/bookings.routes.ts)
- [src/modules/artisans/artisans.routes.ts](/Users/macbook/bundo/server/src/modules/artisans/artisans.routes.ts)
- [client/src/App.tsx](/Users/macbook/bundo/client/src/App.tsx)
- [client/src/types.ts](/Users/macbook/bundo/client/src/types.ts)
