-- Tracks cumulative amount already paid out to the artisan, enabling partial/milestone payouts.
ALTER TABLE "payments" ADD COLUMN "released_amount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: fully released payments have had their entire provider earning sent.
UPDATE "payments" SET "released_amount" = "provider_earning" WHERE "status" = 'RELEASED';
