CREATE TYPE "OnboardingIntent" AS ENUM ('ARTISAN');

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_intent" "OnboardingIntent";
