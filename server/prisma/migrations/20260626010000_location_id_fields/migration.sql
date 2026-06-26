-- Add stable catalog location ids for users and artisans.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location_id" TEXT;
ALTER TABLE "artisan_profiles" ADD COLUMN IF NOT EXISTS "location_id" TEXT;
