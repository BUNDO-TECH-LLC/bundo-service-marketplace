import type { Booking } from '../types';

export type AdminJobFilter =
  | 'all'
  | 'requests'
  | 'appointments'
  | 'ongoing'
  | 'completed'
  | 'payouts';

export type AdminBooking = Booking & {
  conversationId?: string | null;
};

export function jobStageLabel(status: Booking['status']) {
  switch (status) {
    case 'REQUESTED':
      return 'New request';
    case 'ACCEPTED':
      return 'Appointment';
    case 'ONGOING':
      return 'In progress';
    case 'COMPLETED':
      return 'Completed';
    case 'DECLINED':
      return 'Declined';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

export function jobStageClass(status: Booking['status']) {
  switch (status) {
    case 'REQUESTED':
      return 'requested';
    case 'ACCEPTED':
      return 'appointment';
    case 'ONGOING':
      return 'ongoing';
    case 'COMPLETED':
      return 'completed';
    case 'DECLINED':
    case 'CANCELLED':
      return 'closed';
    default:
      return 'requested';
  }
}

export function filterAdminJobs(bookings: AdminBooking[], filter: AdminJobFilter) {
  switch (filter) {
    case 'requests':
      return bookings.filter((booking) => booking.status === 'REQUESTED');
    case 'appointments':
      return bookings.filter((booking) => booking.status === 'ACCEPTED');
    case 'ongoing':
      return bookings.filter((booking) => booking.status === 'ONGOING');
    case 'completed':
      return bookings.filter((booking) => booking.status === 'COMPLETED');
    case 'payouts':
      return bookings.filter((booking) => {
        const paymentStatus = booking.payment?.status;
        const openDispute = booking.disputes?.some(
          (dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW'
        );
        return (
          booking.status === 'COMPLETED' &&
          (paymentStatus === 'PAID_HELD' || Boolean(openDispute))
        );
      });
    default:
      return bookings;
  }
}

export function adminJobFilterCounts(bookings: AdminBooking[]) {
  return {
    all: bookings.length,
    requests: filterAdminJobs(bookings, 'requests').length,
    appointments: filterAdminJobs(bookings, 'appointments').length,
    ongoing: filterAdminJobs(bookings, 'ongoing').length,
    completed: filterAdminJobs(bookings, 'completed').length,
    payouts: filterAdminJobs(bookings, 'payouts').length,
  };
}
