import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function appErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = (req as Request & { requestId?: string }).requestId;

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ error, requestId, code: error.code }, error.message);
    }

    return res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
      ...(requestId ? { requestId } : {}),
    });
  }

  logger.error({ error, requestId }, 'Unhandled request error');

  return res.status(500).json({
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(requestId ? { requestId } : {}),
  });
}
