-- Performance indexes for inbox, payments, and marketplace sorting.
CREATE INDEX "offerings_price_from_idx" ON "offerings"("price_from");
CREATE INDEX "offerings_category_id_price_from_idx" ON "offerings"("category_id", "price_from");
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");
CREATE INDEX "payments_artisan_id_idx" ON "payments"("artisan_id");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "conversations_artisan_id_artisan_inbox_idx" ON "conversations"("artisan_id", "artisan_inbox");
CREATE INDEX "conversations_customer_id_customer_inbox_idx" ON "conversations"("customer_id", "customer_inbox");
