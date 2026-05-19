-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "moderator_id" TEXT;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("firebase_uid") ON DELETE SET NULL ON UPDATE CASCADE;
