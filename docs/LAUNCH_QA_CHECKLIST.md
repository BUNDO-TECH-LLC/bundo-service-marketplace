# Bundo launch QA checklist

Run on **production** after each release.

**Live URLs**

| Service | URL |
|---------|-----|
| Web | https://bundo-service-marketplace.vercel.app |
| API | https://bundo-service-marketplace.onrender.com |
| Health | https://bundo-service-marketplace.onrender.com/health |
| Paystack webhook | https://bundo-service-marketplace.onrender.com/webhooks/paystack |

---

## A. Environment (one-time, before launch)

- [ ] Render `/ready` shows `paystackMode: "live"` and `callbackConfigured: true`
- [ ] Render `PAYSTACK_CALLBACK_URL` = `https://bundo-service-marketplace.vercel.app/workspace/bookings`
- [ ] Render `CORS_ORIGIN` includes Vercel production URL
- [ ] Vercel `VITE_API_BASE_URL` = `/api` (Vercel rewrites `/api/*` to Render)
- [ ] Firebase Console → Authorized domains → `bundo-service-marketplace.vercel.app`
- [ ] Paystack Dashboard → Webhooks → URL set (see Paystack setup below)
- [ ] `ALLOW_PAYMENT_SIMULATION` **not** set on Render

---

## B. Paystack webhook setup

1. Log in to [Paystack Dashboard](https://dashboard.paystack.com) → **Settings** → **API Keys & Webhooks**
2. Under **Webhook URL**, paste:
   ```
   https://bundo-service-marketplace.onrender.com/webhooks/paystack
   ```
   (Alternate path also works: `/payments/webhooks/paystack`)
3. Save. Copy the webhook secret if shown — Paystack signs payloads with your **secret key**.
4. Send a test event or complete a live test payment; confirm booking shows `PAID_HELD` after `charge.success`.

---

## C. Guest & marketing

- [ ] Home loads; marketplace link works
- [ ] Footer **Terms** → `/terms`, **Privacy** → `/privacy`
- [ ] Help center opens; support shows `support@bundo.ng`
- [ ] No console errors on home / marketplace

---

## D. Auth — customer

- [ ] Log in drawer opens (page does not freeze)
- [ ] Email signup → verification email → `/verify-email`
- [ ] `/login` and `/signup` work; Google sign-in completes role if new user
- [ ] Forgot password → reset → sign in at `/login`
- [ ] Signup shows Terms/Privacy links

---

## E. Auth — artisan

- [ ] Artisan signup from drawer or `/signup?role=artisan`
- [ ] Onboarding steps; terms checkbox links work
- [ ] Pending approval screen after submit; logout works

---

## F. Customer workspace

- [ ] Browse marketplace → open artisan profile → create booking
- [ ] **Paystack live payment** → booking shows paid / `PAID_HELD`
- [ ] Messages send/receive (image upload if used)
- [ ] Complete job → leave review
- [ ] Settings (`/workspace/settings`): phone, notifications, password reset email

---

## G. Artisan workspace

- [ ] Dashboard, jobs list, accept → start → complete lifecycle
- [ ] Profile: photos, KYC, bank, availability
- [ ] Settings link to profile works

---

## H. Admin

- [ ] KYC approve/reject; artisan visible on marketplace when approved
- [ ] Jobs queue: assign moderator, lifecycle actions, inline chat
- [ ] Catalog → **New category** creates and appears on marketplace
- [ ] Ledger / payout for test booking
- [ ] Open dispute → **Close dispute** (no payment change) OR release/refund as appropriate
- [ ] Profiles pagination loads; cannot demote last active admin

---

## I. Payments end-to-end (launch gate)

- [ ] Customer pays on production → `PAID_HELD` in UI and DB
- [ ] Paystack webhook `charge.success` received (Dashboard → Webhooks → logs)
- [ ] Job completed → admin release payout (full or partial %)
- [ ] Artisan receives transfer (or OTP flow completes if required)

---

## J. Mobile (375px width)

- [ ] Topbar icon nav; auth drawer scrolls
- [ ] Settings: pill nav, full-width actions

---

## K. Account deletion (test user only)

- [ ] Settings → Delete account → type `DELETE` → signed out; cannot sign in without new signup

---

## Notes

| Date | Tester | Failures / tickets |
|------|--------|-------------------|
|      |        |                   |
