-- CreateEnum
CREATE TYPE "ConversationInboxState" AS ENUM ('ACTIVE', 'SPAM', 'ARCHIVED');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "customer_inbox" "ConversationInboxState" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "conversations" ADD COLUMN "artisan_inbox" "ConversationInboxState" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "chat_user_reports" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reported_user_id" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_user_reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chat_user_reports" ADD CONSTRAINT "chat_user_reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
