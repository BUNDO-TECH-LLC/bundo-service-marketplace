-- Agreed service price (naira) after client/artisan negotiation; listing price remains a guide.
ALTER TABLE "bookings" ADD COLUMN "agreed_amount" INTEGER;
