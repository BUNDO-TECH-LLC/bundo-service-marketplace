CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

CREATE TABLE "artisan_kyc_submissions" (
    "id" TEXT NOT NULL,
    "artisan_id" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "legal_name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "document_image_url" TEXT NOT NULL,
    "selfie_image_url" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "review_note" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artisan_kyc_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "artisan_kyc_submissions_artisan_id_key" ON "artisan_kyc_submissions"("artisan_id");

ALTER TABLE "artisan_kyc_submissions" ADD CONSTRAINT "artisan_kyc_submissions_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisan_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
