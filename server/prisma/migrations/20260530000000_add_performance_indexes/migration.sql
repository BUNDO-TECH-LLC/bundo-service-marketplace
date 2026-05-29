-- Performance indexes for hot query paths (marketplace filters, bookings, chat, notifications, ledgers).

-- ArtisanProfile
CREATE INDEX "artisan_profiles_verify_status_idx" ON "artisan_profiles"("verify_status");
CREATE INDEX "artisan_profiles_city_idx" ON "artisan_profiles"("city");
CREATE INDEX "artisan_profiles_lat_lng_idx" ON "artisan_profiles"("lat", "lng");

-- Offering
CREATE INDEX "offerings_artisan_id_idx" ON "offerings"("artisan_id");
CREATE INDEX "offerings_category_id_idx" ON "offerings"("category_id");

-- AvailabilitySlot
CREATE INDEX "availability_slots_artisan_id_idx" ON "availability_slots"("artisan_id");

-- PortfolioImage
CREATE INDEX "portfolio_images_artisan_id_idx" ON "portfolio_images"("artisan_id");

-- Booking
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");
CREATE INDEX "bookings_artisan_id_idx" ON "bookings"("artisan_id");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
CREATE INDEX "bookings_moderator_id_idx" ON "bookings"("moderator_id");

-- Payout
CREATE INDEX "payouts_booking_id_idx" ON "payouts"("booking_id");
CREATE INDEX "payouts_payment_id_idx" ON "payouts"("payment_id");
CREATE INDEX "payouts_artisan_id_idx" ON "payouts"("artisan_id");

-- Dispute
CREATE INDEX "disputes_booking_id_idx" ON "disputes"("booking_id");
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- LedgerEntry
CREATE INDEX "ledger_entries_booking_id_idx" ON "ledger_entries"("booking_id");
CREATE INDEX "ledger_entries_payment_id_idx" ON "ledger_entries"("payment_id");

-- Review
CREATE INDEX "reviews_artisan_id_idx" ON "reviews"("artisan_id");
CREATE INDEX "reviews_customer_id_idx" ON "reviews"("customer_id");

-- Notification
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- Message
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
