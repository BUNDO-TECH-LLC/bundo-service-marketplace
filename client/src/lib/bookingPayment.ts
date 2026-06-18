import type { Booking, PaymentStatus } from '../types';

const securedStatuses: PaymentStatus[] = [
  'PAID_HELD',
  'PARTIALLY_RELEASED',
  'RELEASED',
  'PARTIALLY_REFUNDED',
];

export function isBookingPaymentSecured(paymentStatus?: PaymentStatus | null) {
  if (!paymentStatus) {
    return false;
  }

  return securedStatuses.includes(paymentStatus);
}

export function canStartOrCompleteBooking(booking: Pick<Booking, 'status' | 'payment'>) {
  return isBookingPaymentSecured(booking.payment?.status);
}

export function canLeaveReview(booking: Pick<Booking, 'status' | 'payment' | 'review'>) {
  return booking.status === 'COMPLETED' && isBookingPaymentSecured(booking.payment?.status) && !booking.review;
}

export function canPayBooking(booking: Pick<Booking, 'status' | 'payment'>) {
  if (['CANCELLED', 'DECLINED', 'COMPLETED'].includes(booking.status)) {
    return false;
  }

  if (isBookingPaymentSecured(booking.payment?.status)) {
    return false;
  }

  return booking.status === 'ACCEPTED' || booking.status === 'ONGOING';
}
