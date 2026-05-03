import { Router } from 'express';
import { Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireRole } from '../../middlewares/requireRole';
import { createReview, getReviewsByCustomer } from './reviews.service';

const router = Router();

router.post('/', verifyFirebaseToken, requireRole(Role.CUSTOMER), async (req, res) => {
  const { bookingId, rating, comment } = req.body;

  if (!bookingId || typeof bookingId !== 'string') {
    return res.status(400).json({ message: 'bookingId is required' });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'rating must be an integer from 1 to 5' });
  }

  if (comment !== undefined && typeof comment !== 'string') {
    return res.status(400).json({ message: 'comment must be a string' });
  }

  const result = await createReview({
    customerId: (req as any).user.firebaseUid,
    bookingId,
    rating,
    comment,
  });

  if (result.status === 'missing_booking') {
    return res.status(404).json({ message: 'Booking not found' });
  }

  if (result.status === 'forbidden') {
    return res.status(403).json({
      message: 'You can only review your own bookings',
    });
  }

  if (result.status === 'self_review') {
    return res.status(403).json({ message: 'You cannot review yourself' });
  }

  if (result.status === 'booking_not_completed') {
    return res.status(409).json({
      message: 'Only completed bookings can be reviewed',
    });
  }

  if (result.status === 'duplicate_review') {
    return res.status(409).json({
      message: 'This booking has already been reviewed',
    });
  }

  return res.status(201).json({
    message: 'Review created',
    review: result.review,
    artisan: result.artisan,
  });
});

router.get('/me', verifyFirebaseToken, requireRole(Role.CUSTOMER), async (req, res) => {
  const reviews = await getReviewsByCustomer((req as any).user.firebaseUid);

  return res.json({
    message: 'My reviews fetched',
    reviews,
  });
});

export default router;
