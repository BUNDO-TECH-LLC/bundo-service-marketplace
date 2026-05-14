import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { verifyFirebaseToken } from './middlewares/verifyFirebaseToken';
import adminRoutes from './modules/admin/admin.routes';
import artisanRoutes from './modules/artisans/artisans.routes';
import bookingRoutes from './modules/bookings/bookings.routes';
import categoryRoutes from './modules/categories/categories.routes';
import chatRoutes from './modules/chat/chat.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import offeringRoutes from './modules/offerings/offerings.routes';
import paymentRoutes from './modules/payments/payments.routes';
import reviewRoutes from './modules/reviews/reviews.routes';
import userRoutes from './modules/users/users.routes';
import logger from './utils/logger';
import db from './db/client';

export function createApp() {
  const app = express();
  const isProduction = env.NODE_ENV === 'production';
  const allowedOrigins = env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (env.PAYSTACK_SECRET_KEY) {
    const paystackMode = env.PAYSTACK_SECRET_KEY.startsWith('sk_test') ? 'test' : 'live';
    logger.info({ paystackMode }, 'Paystack payments enabled');
  } else {
    logger.info('Paystack secret not set: payment initialize and payouts return 503 until configured');
  }

  function isAllowedOrigin(origin?: string) {
    if (!origin || allowedOrigins.includes(origin)) {
      return true;
    }

    try {
      const url = new URL(origin);

      if (isProduction && url.protocol === 'https:' && url.hostname.endsWith('.vercel.app')) {
        return true;
      }

      if (env.NODE_ENV === 'development') {
        return ['localhost', '127.0.0.1'].includes(url.hostname);
      }
    } catch {
      return false;
    }

    return false;
  }

  app.set('trust proxy', isProduction ? 1 : false);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: isProduction ? 600 : 3000,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => {
        const requestPath = req.url.split('?')[0] ?? req.url;
        return ['/health', '/ready'].includes(requestPath);
      },
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: isProduction ? 120 : 1200,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
    })
  );

  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf.toString('utf8');
      },
    })
  );

  app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();

    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
        },
        'HTTP request completed'
      );
    });

    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'bundo-api',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({
        status: 'ready',
        service: 'bundo-api',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'not_ready',
        service: 'bundo-api',
      });
    }
  });

  if (!isProduction) {
    app.get('/protected', verifyFirebaseToken, (req: Request, res: Response) => {
      res.json({
        message: 'You are authenticated',
        user: (req as any).user,
      });
    });
  }

  app.get('/me', verifyFirebaseToken, (req, res) => {
    res.json({
      message: 'User fetched',
      user: (req as any).user,
    });
  });

  app.use('/users', userRoutes);
  app.use('/admin', adminRoutes);
  app.use('/artisans', artisanRoutes);
  app.use('/bookings', bookingRoutes);
  app.use('/categories', categoryRoutes);
  app.use('/', chatRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/offerings', offeringRoutes);
  app.use('/', paymentRoutes);
  app.use('/reviews', reviewRoutes);

  app.use(
    (
      error: Error,
      _req: Request,
      res: Response,
      _next: express.NextFunction
    ) => {
      logger.error(
        {
          error,
          requestId: (res.req as any)?.requestId,
        },
        'Unhandled request error'
      );

      return res.status(500).json({
        message: 'Internal server error',
        requestId: (res.req as any)?.requestId,
      });
    }
  );

  return app;
}
