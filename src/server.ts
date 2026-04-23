import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import cors from 'cors';
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

const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(
  express.json({
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

app.get('/protected', verifyFirebaseToken, (req: Request, res: Response) => {
  res.json({
    message: 'You are authenticated',
    user: (req as any).user,
  });
});

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

const PORT = env.PORT;

const server = app.listen(Number(PORT), () => {
  logger.info({ port: PORT }, 'Server running');
});

server.ref();

export default server;
