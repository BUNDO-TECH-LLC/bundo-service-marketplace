import { BookingStatus, PaymentStatus } from '@prisma/client';

const securedPaymentStatuses: PaymentStatus[] = [
  PaymentStatus.PAID_HELD,
  PaymentStatus.PARTIALLY_RELEASED,
  PaymentStatus.RELEASED,
  PaymentStatus.PARTIALLY_REFUNDED,
];

export function isBookingPaymentSecured(payment?: { status: PaymentStatus } | null) {
  if (!payment) {
    return false;
  }

  return securedPaymentStatuses.includes(payment.status);
}

export function bookingStatusRequiresSecuredPayment(status: BookingStatus) {
  return status === BookingStatus.ONGOING || status === BookingStatus.COMPLETED;
}

export function bookingPaymentRequiredForStatus(
  payment: { status: PaymentStatus } | null | undefined,
  nextStatus: BookingStatus
) {
  if (!bookingStatusRequiresSecuredPayment(nextStatus)) {
    return false;
  }

  return !isBookingPaymentSecured(payment);
}

const paymentInitStatuses: BookingStatus[] = [BookingStatus.ACCEPTED, BookingStatus.ONGOING];

export function bookingStatusAllowsPaymentInit(status: BookingStatus) {
  return paymentInitStatuses.includes(status);
}

const refundablePaymentStatuses: PaymentStatus[] = [
  PaymentStatus.PAID_HELD,
  PaymentStatus.PAYMENT_PENDING,
];

export function isBookingPaymentRefundableOnCancel(
  payment?: { status: PaymentStatus } | null
) {
  if (!payment) {
    return false;
  }

  return refundablePaymentStatuses.includes(payment.status);
}
