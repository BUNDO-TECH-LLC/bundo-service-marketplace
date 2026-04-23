import { Router } from 'express';
import { BookingStatus, Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireRole } from '../../middlewares/requireRole';
import { getPagination, paginationMeta } from '../../utils/pagination';
import {
  createBookingDispute,
} from '../payments/payments.service';
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
  requireRole(Role.CUSTOMER),
  async (req, res) => {
    const { offeringId, scheduledAt, note } = req.body;

    if (!offeringId || typeof offeringId !== 'string') {
      return res.status(400).json({ message: 'offeringId is required' });
    }

    let scheduledDate: Date | undefined;

    if (scheduledAt !== undefined) {
      if (typeof scheduledAt !== 'string') {
        return res.status(400).json({ message: 'scheduledAt must be a date string' });
      }

      scheduledDate = new Date(scheduledAt);

      if (Number.isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: 'scheduledAt must be a valid date' });
      }
    }

    if (note !== undefined && typeof note !== 'string') {
      return res.status(400).json({ message: 'note must be a string' });
    }

    const booking = await createBooking({
      customerId: (req as any).user.firebaseUid,
      offeringId,
      scheduledAt: scheduledDate,
      note,
    });

    if (!booking) {
      return res.status(404).json({ message: 'Offering not found' });
    }

    return res.status(201).json({
      message: 'Booking requested',
      booking,
    });
  }
);

router.get('/', verifyFirebaseToken, async (req, res) => {
  const bookings = await getBookingsForUser({
    firebaseUid: (req as any).user.firebaseUid,
    role: (req as any).user.role,
  });

  return res.json({
    message: 'Bookings fetched',
    bookings,
  });
});

router.get(
  '/customer',
  verifyFirebaseToken,
  requireRole(Role.CUSTOMER),
  async (req, res) => {
    const pagination = getPagination(req);
    const [bookings, total] = await Promise.all([
      getCustomerBookings((req as any).user.firebaseUid, pagination),
      countCustomerBookings((req as any).user.firebaseUid),
    ]);

    return res.json({
      message: 'Customer bookings fetched',
      bookings,
      meta: {
        ...paginationMeta(pagination),
        total,
      },
    });
  }
);

router.get(
  '/artisan',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const pagination = getPagination(req);
    const [bookings, total] = await Promise.all([
      getArtisanBookings((req as any).user.firebaseUid, pagination),
      countArtisanBookings((req as any).user.firebaseUid),
    ]);

    if (!bookings || total === null) {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    return res.json({
      message: 'Artisan bookings fetched',
      bookings,
      meta: {
        ...paginationMeta(pagination),
        total,
      },
    });
  }
);

router.get('/:id', verifyFirebaseToken, async (req, res) => {
  const result = await getBookingForUser({
    bookingId: String(req.params.id),
    firebaseUid: (req as any).user.firebaseUid,
    role: (req as any).user.role,
  });

  if (result.status === 'missing_booking') {
    return res.status(404).json({ message: 'Booking not found' });
  }

  if (result.status === 'forbidden') {
    return res.status(403).json({
      message: 'You can only view bookings that belong to you',
    });
  }

  return res.json({
    message: 'Booking fetched',
    booking: result.booking,
  });
});

router.patch(
  '/:id/cancel',
  verifyFirebaseToken,
  requireRole(Role.CUSTOMER),
  async (req, res) => {
    const result = await cancelBookingForCustomer({
      bookingId: String(req.params.id),
      customerId: (req as any).user.firebaseUid,
    });

    if (result.status === 'missing_booking') {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only cancel your own bookings',
      });
    }

    if (result.status === 'not_cancellable') {
      return res.status(409).json({
        message: 'Only REQUESTED or ACCEPTED bookings can be cancelled',
      });
    }

    return res.json({
      message: 'Booking cancelled',
      booking: result.booking,
    });
  }
);

router.post('/:id/dispute', verifyFirebaseToken, async (req, res) => {
  const { reason } = req.body;

  if (typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ message: 'reason is required' });
  }

  const result = await createBookingDispute({
    bookingId: String(req.params.id),
    raisedById: (req as any).user.firebaseUid,
    reason,
  });

  if (result.status === 'missing_booking') {
    return res.status(404).json({ message: 'Booking not found' });
  }

  if (result.status === 'forbidden') {
    return res.status(403).json({ message: 'You can only dispute your own booking' });
  }

  if (result.status === 'already_open') {
    return res.status(409).json({
      message: 'There is already an open dispute for this booking',
      dispute: result.dispute,
    });
  }

  return res.status(201).json({
    message: 'Dispute opened',
    dispute: result.dispute,
  });
});

router.patch(
  '/:id/reschedule',
  verifyFirebaseToken,
  async (req, res) => {
    const { scheduledAt, note } = req.body;

    if (typeof scheduledAt !== 'string') {
      return res.status(400).json({ message: 'scheduledAt must be a date string' });
    }

    const scheduledDate = new Date(scheduledAt);

    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ message: 'scheduledAt must be a valid date' });
    }

    if (note !== undefined && typeof note !== 'string') {
      return res.status(400).json({ message: 'note must be a string' });
    }

    const result = await rescheduleBooking({
      bookingId: String(req.params.id),
      actorId: (req as any).user.firebaseUid,
      role: (req as any).user.role,
      scheduledAt: scheduledDate,
      note,
    });

    if (result.status === 'missing_booking') {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only reschedule your own bookings',
      });
    }

    if (result.status === 'not_reschedulable') {
      return res.status(409).json({
        message: 'Only REQUESTED or ACCEPTED bookings can be rescheduled',
      });
    }

    if (result.status === 'invalid_schedule') {
      return res.status(400).json({
        message: 'scheduledAt must be a future date and time',
      });
    }

    if (result.status === 'outside_availability') {
      return res.status(409).json({
        message: 'The selected time is outside the artisan availability window',
      });
    }

    return res.json({
      message: 'Booking rescheduled',
      booking: result.booking,
    });
  }
);

router.patch(
  '/:id/status',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const { status } = req.body;
    const allowedStatuses = [
      BookingStatus.ACCEPTED,
      BookingStatus.DECLINED,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'status must be ACCEPTED, DECLINED, COMPLETED, or CANCELLED',
      });
    }

    const result = await updateBookingStatusForArtisan({
      bookingId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
      status,
    });

    if (result.status === 'missing_artisan') {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    if (result.status === 'missing_booking') {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only update bookings for your own artisan profile',
      });
    }

    return res.json({
      message: 'Booking status updated',
      booking: result.booking,
    });
  }
);

export default router;
