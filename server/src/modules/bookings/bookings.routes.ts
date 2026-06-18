import { Router } from 'express';
import { BookingStatus, Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireVerifiedEmail } from '../../middlewares/requireVerifiedEmail';
import { requireRole } from '../../middlewares/requireRole';
import { asyncHandler } from '../../middlewares/errorHandler';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { respondIfChatSchemaError } from '../../utils/handleChatSchemaError';
import { throwOnServiceStatus } from '../../utils/resultErrors';
import { getPagination, paginationMeta } from '../../utils/pagination';
import { createBookingDispute } from '../payments/payments.service';
import {
  cancelBookingForCustomer,
  countArtisanBookings,
  countCustomerBookings,
  createBooking,
  getArtisanBookings,
  getBookingForUser,
  getBookingsForUser,
  getCustomerBookings,
  rescheduleBooking,
  updateBookingStatusForArtisan,
} from './bookings.service';

const router = Router();

router.post(
  '/',
  verifyFirebaseToken,
  requireVerifiedEmail,
  requireRole(Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    try {
      const { offeringId, scheduledAt, note } = req.body;

      if (!offeringId || typeof offeringId !== 'string') {
        throw new ValidationError('offeringId is required');
      }

      if (!scheduledAt || typeof scheduledAt !== 'string') {
        throw new ValidationError('scheduledAt is required');
      }

      const scheduledDate = new Date(scheduledAt);

      if (Number.isNaN(scheduledDate.getTime())) {
        throw new ValidationError('scheduledAt must be a valid date');
      }

      if (note !== undefined && typeof note !== 'string') {
        throw new ValidationError('note must be a string');
      }

      const booking = await createBooking({
        customerId: (req as any).user.firebaseUid,
        offeringId,
        scheduledAt: scheduledDate,
        ...(typeof note === 'string' ? { note } : {}),
      });

      if (!booking) {
        throw new NotFoundError('Offering');
      }

      res.status(201).json({
        message: 'Booking requested',
        booking,
      });
    } catch (error: unknown) {
      if (respondIfChatSchemaError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const bookings = await getBookingsForUser({
      firebaseUid: (req as any).user.firebaseUid,
      role: (req as any).user.role,
    });

    res.json({
      message: 'Bookings fetched',
      bookings,
    });
  })
);

router.get(
  '/customer',
  verifyFirebaseToken,
  requireRole(Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req);
    const [bookings, total] = await Promise.all([
      getCustomerBookings((req as any).user.firebaseUid, pagination),
      countCustomerBookings((req as any).user.firebaseUid),
    ]);

    res.json({
      message: 'Customer bookings fetched',
      bookings,
      meta: {
        ...paginationMeta(pagination),
        total,
      },
    });
  })
);

router.get(
  '/artisan',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req);
    const [bookings, total] = await Promise.all([
      getArtisanBookings((req as any).user.firebaseUid, pagination),
      countArtisanBookings((req as any).user.firebaseUid),
    ]);

    if (!bookings || total === null) {
      throw new NotFoundError('Artisan profile');
    }

    res.json({
      message: 'Artisan bookings fetched',
      bookings,
      meta: {
        ...paginationMeta(pagination),
        total,
      },
    });
  })
);

router.get(
  '/:id',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const result = await getBookingForUser({
      bookingId: String(req.params.id),
      firebaseUid: (req as any).user.firebaseUid,
      role: (req as any).user.role,
    });

    throwOnServiceStatus(result.status, {
      missing_booking: new NotFoundError('Booking'),
      forbidden: new ForbiddenError('You can only view bookings that belong to you'),
    });

    res.json({
      message: 'Booking fetched',
      booking: result.booking,
    });
  })
);

router.patch(
  '/:id/cancel',
  verifyFirebaseToken,
  requireRole(Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const result = await cancelBookingForCustomer({
      bookingId: String(req.params.id),
      customerId: (req as any).user.firebaseUid,
    });

    throwOnServiceStatus(result.status, {
      missing_booking: new NotFoundError('Booking'),
      forbidden: new ForbiddenError('You can only cancel your own bookings'),
      not_cancellable: new ConflictError('Only REQUESTED or ACCEPTED bookings can be cancelled'),
    });

    res.json({
      message: 'Booking cancelled',
      booking: result.booking,
    });
  })
);

router.post(
  '/:id/dispute',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { reason } = req.body;

    if (typeof reason !== 'string' || !reason.trim()) {
      throw new ValidationError('reason is required');
    }

    const result = await createBookingDispute({
      bookingId: String(req.params.id),
      raisedById: (req as any).user.firebaseUid,
      reason,
    });

    throwOnServiceStatus(result.status, {
      missing_booking: new NotFoundError('Booking'),
      forbidden: new ForbiddenError('You can only dispute your own booking'),
      not_disputable: new ConflictError(
        'Disputes can only be opened after your booking is accepted and payment is held.',
        'DISPUTE_NOT_ALLOWED'
      ),
      payment_not_held: new ConflictError(
        'Payment must be secured before opening a dispute.',
        'DISPUTE_PAYMENT_REQUIRED'
      ),
      invalid_reason: new ValidationError('Describe the issue in 500 characters or fewer.'),
      already_open: new ConflictError('There is already an open dispute for this booking', 'DISPUTE_ALREADY_OPEN'),
    });

    res.status(201).json({
      message: 'Dispute opened',
      dispute: result.dispute,
    });
  })
);

router.patch(
  '/:id/reschedule',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { scheduledAt, note } = req.body;

    if (typeof scheduledAt !== 'string') {
      throw new ValidationError('scheduledAt must be a date string');
    }

    const scheduledDate = new Date(scheduledAt);

    if (Number.isNaN(scheduledDate.getTime())) {
      throw new ValidationError('scheduledAt must be a valid date');
    }

    if (note !== undefined && typeof note !== 'string') {
      throw new ValidationError('note must be a string');
    }

    const result = await rescheduleBooking({
      bookingId: String(req.params.id),
      actorId: (req as any).user.firebaseUid,
      role: (req as any).user.role,
      scheduledAt: scheduledDate,
      note,
    });

    throwOnServiceStatus(result.status, {
      missing_booking: new NotFoundError('Booking'),
      forbidden: new ForbiddenError('You can only reschedule your own bookings'),
      not_reschedulable: new ConflictError('Only REQUESTED or ACCEPTED bookings can be rescheduled'),
      invalid_schedule: new ValidationError('scheduledAt must be a future date and time'),
      outside_availability: new ConflictError(
        'The selected time is outside the artisan availability window'
      ),
    });

    res.json({
      message: 'Booking rescheduled',
      booking: result.booking,
    });
  })
);

router.patch(
  '/:id/status',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  asyncHandler(async (req, res) => {
    try {
      const { status } = req.body;
      const allowedStatuses = [
        BookingStatus.ACCEPTED,
        BookingStatus.ONGOING,
        BookingStatus.DECLINED,
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ];

      if (!allowedStatuses.includes(status)) {
        throw new ValidationError(
          'status must be ACCEPTED, ONGOING, DECLINED, COMPLETED, or CANCELLED'
        );
      }

      const result = await updateBookingStatusForArtisan({
        bookingId: String(req.params.id),
        artisanUserId: (req as any).user.firebaseUid,
        status,
      });

      throwOnServiceStatus(result.status, {
        missing_artisan: new NotFoundError('Artisan profile'),
        missing_booking: new NotFoundError('Booking'),
        forbidden: new ForbiddenError('You can only update bookings for your own artisan profile'),
        invalid_transition: new ConflictError(
          `Cannot move booking from ${result.from} to ${status}`
        ),
        payment_required: new ConflictError(
          'Customer payment must be secured through Paystack before the service can start or be marked completed',
          'PAYMENT_REQUIRED'
        ),
      });

      res.json({
        message: 'Booking status updated',
        booking: result.booking,
      });
    } catch (error: unknown) {
      if (respondIfChatSchemaError(error, res)) return;
      throw error;
    }
  })
);

export default router;
