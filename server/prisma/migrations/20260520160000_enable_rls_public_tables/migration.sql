-- Lock down public tables for Supabase PostgREST (anon/authenticated roles).
-- Bundo uses Express + Prisma only; the postgres pooler role bypasses RLS.
-- With RLS enabled and no permissive policies, direct Supabase Data API access is denied.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "artisan_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offerings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "availability_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portfolio_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_payout_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "disputes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "artisan_kyc_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_user_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_notes" ENABLE ROW LEVEL SECURITY;

-- Prisma migration history (also lives in public schema on Supabase).
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Defense in depth: strip default PostgREST grants from browser-facing roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;
  END IF;
END $$;
