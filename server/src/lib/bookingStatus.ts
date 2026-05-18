import { BookingStatus } from '@prisma/client';

export const artisanBookingStatusTransitions: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.REQUESTED]: [
    BookingStatus.ACCEPTED,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.ACCEPTED]: [
    BookingStatus.ONGOING,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.ONGOING]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.DECLINED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.COMPLETED]: [],
};

export const adminBookingStatusTransitions: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.REQUESTED]: [BookingStatus.ACCEPTED, BookingStatus.CANCELLED],
  [BookingStatus.ACCEPTED]: [
    BookingStatus.ONGOING,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.ONGOING]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.DECLINED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.COMPLETED]: [],
};

export function canTransitionBookingStatus(
  from: BookingStatus,
  to: BookingStatus,
  actor: 'artisan' | 'admin'
) {
  const transitions =
    actor === 'admin' ? adminBookingStatusTransitions : artisanBookingStatusTransitions;

  return (transitions[from] ?? []).includes(to);
}

export function bookingStatusCreatesAppointment(status: BookingStatus) {
  return status === BookingStatus.ACCEPTED;
}

export function bookingStatusNotificationCopy(input: {
  status: BookingStatus;
  serviceTitle?: string | null;
  byAdmin?: boolean;
}) {
  const service = input.serviceTitle || 'a service';
  const prefix = input.byAdmin ? 'Support updated your booking' : 'Your booking';

  switch (input.status) {
    case BookingStatus.ACCEPTED:
      return {
        title: 'Booking accepted',
        body: `${prefix} for ${service} was accepted.`,
      };
    case BookingStatus.ONGOING:
      return {
        title: 'Service in progress',
        body: `${prefix} for ${service} is now in progress.`,
      };
    case BookingStatus.DECLINED:
      return {
        title: 'Booking declined',
        body: `${prefix} for ${service} was declined.`,
      };
    case BookingStatus.COMPLETED:
      return {
        title: 'Booking completed',
        body: `${prefix} for ${service} was marked completed.`,
      };
    case BookingStatus.CANCELLED:
      return {
        title: 'Booking cancelled',
        body: input.byAdmin
          ? `Your booking for ${service} was cancelled by support.`
          : `${prefix} for ${service} was cancelled.`,
      };
    default:
      return {
        title: 'Booking updated',
        body: `${prefix} for ${service} was updated.`,
      };
  }
}
