import { Router } from 'express';
import { Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireRole } from '../../middlewares/requireRole';
import { asyncHandler } from '../../middlewares/errorHandler';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { throwOnServiceStatus } from '../../utils/resultErrors';
import { createReview, getReviewsByCustomer } from './reviews.service';

const router = Router();

router.post(
  '/',
  verifyFirebaseToken,
  requireRole(Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || typeof bookingId !== 'string') {
      throw new ValidationError('bookingId is required');
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError('rating must be an integer from 1 to 5');
    }

    if (comment !== undefined && typeof comment !== 'string') {
      throw new ValidationError('comment must be a string');
    }

    const result = await createReview({
      customerId: (req as any).user.firebaseUid,
      bookingId,
      rating,
      comment,
    });

    throwOnServiceStatus(result.status, {
      missing_booking: new NotFoundError('Booking'),
      forbidden: new ForbiddenError('You can only review your own bookings'),
      self_review: new ForbiddenError('You cannot review yourself'),
      booking_not_completed: new ConflictError(
        'Only completed bookings can be reviewed',
        'BOOKING_NOT_COMPLETED'
      ),
      payment_not_secured: new ConflictError(
        'Reviews are only available after payment has been secured for the completed job',
        'PAYMENT_NOT_SECURED'
      ),
      duplicate_review: new ConflictError('This booking has already been reviewed', 'DUPLICATE_REVIEW'),
    });

    if (result.status !== 'created') {
      throw new Error('Unexpected review result');
    }

    res.status(201).json({
      message: 'Review created',
      review: result.review,
      artisan: result.artisan,
    });
  })
);

router.get(
  '/me',
  verifyFirebaseToken,
  requireRole(Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const reviews = await getReviewsByCustomer((req as any).user.firebaseUid);

    res.json({
      message: 'My reviews fetched',
      reviews,
    });
  })
);

export default router;
