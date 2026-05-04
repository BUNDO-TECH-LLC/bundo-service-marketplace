# Bundo Deployment Guide

This project deploys as three pieces:

- `client/` to Vercel as the Vite React web app
- `server/` to Render as the Express API
- Supabase Postgres as the shared database

## 1. Backend on Render

Use the root `render.yaml` blueprint, or create a Render Web Service manually with:

- Root directory: `server`
- Build command: `npm ci && npx prisma generate && npm run build`
- Start command: `npm run start`
- Health check path: `/health`

Set these Render environment variables:

```bash
NODE_ENV=production
CORS_ORIGIN=https://your-vercel-domain.vercel.app
DATABASE_URL=your_supabase_pooler_url
DIRECT_URL=your_supabase_direct_url
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_CALLBACK_URL=https://your-vercel-domain.vercel.app/?view=workspace&section=bookings
PLATFORM_FEE_PERCENT=10
```

After deploy, verify:

```bash
curl https://your-render-service.onrender.com/health
curl https://your-render-service.onrender.com/ready
curl https://your-render-service.onrender.com/categories
```

## 2. Frontend on Vercel

Create a Vercel project from the repo with:

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`

Set these Vercel environment variables:

```bash
VITE_API_BASE_URL=https://your-render-service.onrender.com
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_VAPID_KEY=your_firebase_web_push_key
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

## 3. Post-deploy Settings

- Add the Vercel domain to Firebase Authentication authorized domains.
- Add the Vercel domain to the Render `CORS_ORIGIN` value.
- Set Paystack callback URL to the Vercel booking callback URL.
- If using Firebase Messaging, make sure `/firebase-messaging-sw.js` is reachable from the Vercel domain.
- Rotate production secrets before launch if any local secret has been shared or exposed.

## 4. Smoke Test

Run through this order after both services are live:

1. Open the Vercel app.
2. Confirm marketplace categories, artisans, and offerings load.
3. Sign up or sign in with Firebase.
4. Select a customer role and create a booking.
5. Select or use an artisan account and accept the booking.
6. Initialize payment.
7. Confirm notifications and chat load.
8. Use an admin account to inspect bookings, KYC, conversations, and categories.
