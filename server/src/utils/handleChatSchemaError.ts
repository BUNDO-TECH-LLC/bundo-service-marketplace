import type { Response } from 'express';
import logger from './logger';
import { isChatInboxSchemaError } from '../modules/chat/chatSchemaErrors';

const MIGRATION_MESSAGE =
  'Messaging needs a database update. On the server host, run: cd server && npx prisma migrate deploy (or npm run db:migrate:deploy:pooler), then try again.';

export function respondIfChatSchemaError(error: unknown, res: Response): boolean {
  if (!isChatInboxSchemaError(error)) {
    return false;
  }

  logger.error({ error }, 'Chat/inbox query failed — database migration may be missing');
  res.status(503).json({
    message: MIGRATION_MESSAGE,
    code: 'SCHEMA_MIGRATION_REQUIRED',
  });
  return true;
}
