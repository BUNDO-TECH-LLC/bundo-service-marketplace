import express, { Request, Response } from 'express';
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
    console.error(error);

    return res.status(500).json({
      message: 'Internal server error',
    });
  }
);

const PORT = env.PORT;

const server = app.listen(Number(PORT), () => {
  console.log(`Server running on port ${PORT}`);
});

server.ref();

export default server;
