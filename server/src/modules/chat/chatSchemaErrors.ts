/** Detects Prisma/Postgres errors when inbox columns or chat reports table are missing (migration not applied). */
export function isChatInboxSchemaError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes('customer_inbox') ||
    text.includes('artisan_inbox') ||
    text.includes('chat_user_reports') ||
    text.includes('ConversationInboxState')
  );
}
