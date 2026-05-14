import { BookingStatus, NotificationType, Prisma, Role } from '@prisma/client';
import db from '../../db/client';
import { Pagination, paginationArgs } from '../../utils/pagination';
import { getArtisanProfileByUserId } from '../artisans/artisans.service';
import { createNotifications } from '../notifications/notifications.service';

function toMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function bookingFitsAvailability(
  scheduledAt: Date,
  slots: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>
) {
  const activeSlots = slots.filter((slot) => slot.isActive);

  if (!activeSlots.length) {
    return true;
  }

  const dayOfWeek = scheduledAt.getDay();
  const minuteOfDay = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();

  return activeSlots.some((slot) => {
    if (slot.dayOfWeek !== dayOfWeek) {
      return false;
    }

    const start = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);
    return minuteOfDay >= start && minuteOfDay < end;
  });
}

function bookingThreadMessage(input: {
  serviceTitle?: string | null;
  scheduledAt?: Date | null;
  note?: string | null;
}) {
  const parts = [`Booking request opened for ${input.serviceTitle || 'a service'}.`];

  if (input.scheduledAt) {
    parts.push(`Scheduled for ${input.scheduledAt.toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Lagos',
    })}.`);
  }

  if (input.note?.trim()) {
    parts.push(`Customer note: ${input.note.trim()}`);
  }

  return parts.join(' ');
}

export const createBooking = async (input: {
  customerId: string;
  offeringId: string;
  scheduledAt?: Date;
  note?: string;
}) => {
  const offering = await db.offering.findUnique({
    where: { id: input.offeringId },
  });

  if (!offering) {
    return null;
  }

  const booking = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdBooking = await tx.booking.create({
      data: {
        customerId: input.customerId,
        artisanId: offering.artisanId,
        offeringId: offering.id,
        ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      include: {
        artisan: true,
        payment: true,
        disputes: true,
        offering: {
          include: { category: true },
        },
      },
    });

    const conversation = await tx.conversation.upsert({
      where: {
        customerId_artisanId: {
          customerId: input.customerId,
          artisanId: offering.artisanId,
        },
      },
      update: { updatedAt: new Date() },
      create: {
        customerId: input.customerId,
        artisanId: offering.artisanId,
      },
    });

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: input.customerId,
        body: bookingThreadMessage({
          serviceTitle: createdBooking.offering?.title,
          scheduledAt: createdBooking.scheduledAt,
          note: createdBooking.note,
        }),
      },
    });

    return createdBooking;
  });

  const artisan = await db.artisanProfile.findUnique({
    where: { id: offering.artisanId },
  });

  if (artisan) {
    await createNotifications([
      {
        userId: input.customerId,
        type: NotificationType.BOOKING,
        title: 'Booking requested',
        body: `Your booking for ${booking.offering?.title || 'a service'} has been sent.`,
        link: '/?view=workspace&section=bookings',
      },
      {
        userId: artisan.userId,
        type: NotificationType.BOOKING,
        title: 'New booking request',
        body: `You received a new booking request for ${booking.offering?.title || 'a service'}.`,
        link: '/?view=workspace&section=bookings',
      },
    ]);
  }

  return booking;
};

export const getBookingsForUser = async (input: {
  firebaseUid: string;
  role: Role | null;
}) => {
  if (input.role === Role.ARTISAN) {
    const artisan = await getArtisanProfileByUserId(input.firebaseUid);

    if (!artisan) {
      return [];
    }

    return db.booking.findMany({
      where: { artisanId: artisan.id },
      orderBy: { createdAt: 'desc' },
      include: {
        customerUser: {
          select: {
            firebaseUid: true,
            email: true,
            phone: true,
          },
        },
        offering: {
          include: { category: true },
        },
        payment: true,
        disputes: true,
      },
    });
  }

  return db.booking.findMany({
    where: { customerId: input.firebaseUid },
    orderBy: { createdAt: 'desc' },
    include: {
      artisan: true,
      payment: true,
      disputes: true,
      offering: {
        include: { category: true },
      },
    },
  });
};

export const getCustomerBookings = async (
  customerId: string,
  pagination?: Pagination
) => {
  return db.booking.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    ...paginationArgs(pagination),
    include: {
      artisan: true,
      payment: true,
      disputes: true,
      offering: {
        include: { category: true },
      },
    },
  });
};

export const countCustomerBookings = async (customerId: string) => {
  return db.booking.count({ where: { customerId } });
};

export const getArtisanBookings = async (
  artisanUserId: string,
  pagination?: Pagination
) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return db.booking.findMany({
    where: { artisanId: artisan.id },
    orderBy: { createdAt: 'desc' },
    ...paginationArgs(pagination),
    include: {
      customerUser: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
        },
      },
      offering: {
        include: { category: true },
      },
      payment: true,
      disputes: true,
    },
  });
};

export const countArtisanBookings = async (artisanUserId: string) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return db.booking.count({ where: { artisanId: artisan.id } });
};

export const getBookingForUser = async (input: {
  bookingId: string;
  firebaseUid: string;
  role: Role | null;
}) => {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      customerUser: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
        },
      },
      artisan: true,
      payment: true,
      disputes: true,
      offering: {
        include: { category: true },
      },
    },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  if (booking.customerId === input.firebaseUid) {
    return { status: 'found' as const, booking };
  }

  if (input.role === Role.ARTISAN) {
    const artisan = await getArtisanProfileByUserId(input.firebaseUid);

    if (artisan && booking.artisanId === artisan.id) {
      return { status: 'found' as const, booking };
    }
  }

  return { status: 'forbidden' as const };
};

export const cancelBookingForCustomer = async (input: {
  bookingId: string;
  customerId: string;
}) => {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  if (booking.customerId !== input.customerId) {
    return { status: 'forbidden' as const };
  }

  const cancellableStatuses: BookingStatus[] = [
    BookingStatus.REQUESTED,
    BookingStatus.ACCEPTED,
  ];

  if (!cancellableStatuses.includes(booking.status)) {
    return { status: 'not_cancellable' as const };
  }

  const updated = await db.booking.update({
    where: { id: input.bookingId },
    data: { status: BookingStatus.CANCELLED },
    include: {
      artisan: true,
      offering: {
        include: { category: true },
      },
      payment: true,
      disputes: true,
    },
  });

  if (updated.artisan?.userId) {
    await createNotifications([
      {
        userId: updated.customerId,
        type: NotificationType.BOOKING,
        title: 'Booking cancelled',
        body: `Your booking for ${updated.offering?.title || 'a service'} has been cancelled.`,
        link: '/?view=workspace&section=bookings',
      },
      {
        userId: updated.artisan.userId,
        type: NotificationType.BOOKING,
        title: 'Booking cancelled by customer',
        body: `The customer cancelled ${updated.offering?.title || 'a service'}.`,
        link: '/?view=workspace&section=bookings',
      },
    ]);
  }

  return { status: 'cancelled' as const, booking: updated };
};

export const updateBookingStatusForArtisan = async (input: {
  bookingId: string;
  artisanUserId: string;
  status: BookingStatus;
}) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  if (booking.artisanId !== artisan.id) {
    return { status: 'forbidden' as const };
  }

  const updated = await db.booking.update({
    where: { id: input.bookingId },
    data: { status: input.status },
    include: {
      customerUser: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
        },
      },
      offering: {
        include: { category: true },
      },
      payment: true,
      disputes: true,
      artisan: true,
    },
  });

  await createNotifications([
    {
      userId: updated.customerId,
      type: NotificationType.BOOKING,
      title:
        input.status === BookingStatus.ACCEPTED
          ? 'Booking accepted'
          : input.status === BookingStatus.DECLINED
            ? 'Booking declined'
            : input.status === BookingStatus.COMPLETED
              ? 'Booking completed'
              : 'Booking updated',
      body:
        input.status === BookingStatus.ACCEPTED
          ? `Your booking for ${updated.offering?.title || 'a service'} was accepted.`
          : input.status === BookingStatus.DECLINED
            ? `Your booking for ${updated.offering?.title || 'a service'} was declined.`
            : input.status === BookingStatus.COMPLETED
              ? `Your booking for ${updated.offering?.title || 'a service'} was marked completed.`
              : `Your booking for ${updated.offering?.title || 'a service'} was updated.`,
      link: '/?view=workspace&section=bookings',
    },
  ]);

  return { status: 'updated' as const, booking: updated };
};

export const rescheduleBooking = async (input: {
  bookingId: string;
  actorId: string;
  role: Role | null;
  scheduledAt: Date;
  note?: string;
}) => {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      customerUser: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
        },
      },
      artisan: {
        include: {
          availabilitySlots: {
            where: { isActive: true },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
        },
      },
      offering: {
        include: { category: true },
      },
      payment: true,
      disputes: true,
    },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  const isCustomer = booking.customerId === input.actorId;
  const isArtisan =
    input.role === Role.ARTISAN && booking.artisan?.userId === input.actorId;

  if (!isCustomer && !isArtisan) {
    return { status: 'forbidden' as const };
  }

  if (
    !([BookingStatus.REQUESTED, BookingStatus.ACCEPTED] as BookingStatus[]).includes(
      booking.status
    )
  ) {
    return { status: 'not_reschedulable' as const };
  }

  if (input.scheduledAt.getTime() <= Date.now()) {
    return { status: 'invalid_schedule' as const };
  }

  if (
    booking.artisan &&
    !bookingFitsAvailability(input.scheduledAt, booking.artisan.availabilitySlots)
  ) {
    return { status: 'outside_availability' as const };
  }

  const updated = await db.booking.update({
    where: { id: input.bookingId },
    data: {
      scheduledAt: input.scheduledAt,
      note: input.note !== undefined ? input.note : booking.note,
    },
    include: {
      customerUser: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
        },
      },
      artisan: true,
      payment: true,
      disputes: true,
      offering: {
        include: { category: true },
      },
    },
  });

  const actorLabel = isCustomer ? 'customer' : 'artisan';
  const serviceName = updated.offering?.title || 'a service';

  if (updated.artisan?.userId) {
    await createNotifications([
      {
        userId: updated.customerId,
        type: NotificationType.BOOKING,
        title: isCustomer ? 'Booking time updated' : 'Artisan updated your booking time',
        body: isCustomer
          ? `You moved ${serviceName} to ${updated.scheduledAt?.toLocaleString()}.`
          : `${updated.artisan.displayName || 'Your artisan'} moved ${serviceName} to ${updated.scheduledAt?.toLocaleString()}.`,
        link: '/?view=workspace&section=bookings',
      },
      {
        userId: updated.artisan.userId,
        type: NotificationType.BOOKING,
        title: isCustomer ? 'Customer updated booking time' : 'Booking time updated',
        body: isCustomer
          ? `The customer moved ${serviceName} to ${updated.scheduledAt?.toLocaleString()}.`
          : `You moved ${serviceName} to ${updated.scheduledAt?.toLocaleString()}.`,
        link: '/?view=workspace&section=bookings',
      },
    ]);
  }

  return { status: 'rescheduled' as const, booking: updated, actor: actorLabel };
};
