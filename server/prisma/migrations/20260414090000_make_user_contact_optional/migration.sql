ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
