import { BookingStatus, NotificationType, Prisma } from '@prisma/client';
import db from '../../db/client';
import { isBookingPaymentSecured } from '../../lib/bookingPayment';
import { createNotification } from '../notifications/notifications.service';

export const createReview = async (input: {
  customerId: string;
  bookingId: string;
  rating: number;
  comment?: string;
}) => {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      artisan: true,
      review: true,
      payment: true,
    },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  if (booking.customerId !== input.customerId) {
    return { status: 'forbidden' as const };
  }

  if (booking.artisan.userId === input.customerId) {
    return { status: 'self_review' as const };
  }

  if (booking.status !== BookingStatus.COMPLETED) {
    return { status: 'booking_not_completed' as const };
  }

  if (!isBookingPaymentSecured(booking.payment)) {
    return { status: 'payment_not_secured' as const };
  }

  if (booking.review) {
    return { status: 'duplicate_review' as const };
  }

  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const review = await tx.review.create({
      data: {
        bookingId: booking.id,
        customerId: input.customerId,
        artisanId: booking.artisanId,
        rating: input.rating,
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
      include: {
        customer: {
          select: {
            firebaseUid: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const aggregate = await tx.review.aggregate({
      where: { artisanId: booking.artisanId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const artisan = await tx.artisanProfile.update({
      where: { id: booking.artisanId },
      data: {
        avgRating: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      },
    });

    return { review, artisan };
  });

  await createNotification({
    userId: booking.artisan.userId,
    type: NotificationType.REVIEW,
    title: 'New review received',
    body: `A customer left a ${input.rating}-star review on your completed service.`,
    link: `/artisans/${booking.artisanId}`,
  });

  return { status: 'created' as const, ...result };
};

export const getReviewsForArtisan = async (artisanId: string) => {
  const artisan = await db.artisanProfile.findUnique({
    where: { id: artisanId },
  });

  if (!artisan) {
    return null;
  }

  return db.review.findMany({
    where: { artisanId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      customer: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
        },
      },
      booking: {
        select: {
          id: true,
          offering: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
        },
      },
    },
  });
};

export const getReviewsByCustomer = async (customerId: string) => {
  return db.review.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      artisan: {
        select: {
          id: true,
          displayName: true,
          city: true,
          area: true,
        },
      },
      booking: {
        select: {
          id: true,
          offering: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
        },
      },
    },
  });
};
