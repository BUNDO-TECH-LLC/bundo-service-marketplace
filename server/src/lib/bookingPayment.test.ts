import { BookingStatus, PaymentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  bookingPaymentRequiredForStatus,
  isBookingPaymentSecured,
} from './bookingPayment';

describe('bookingPayment guards', () => {
  it('treats held and released payments as secured', () => {
    expect(isBookingPaymentSecured({ status: PaymentStatus.PAID_HELD })).toBe(true);
    expect(isBookingPaymentSecured({ status: PaymentStatus.RELEASED })).toBe(true);
    expect(isBookingPaymentSecured({ status: PaymentStatus.UNPAID })).toBe(false);
    expect(isBookingPaymentSecured(null)).toBe(false);
  });

  it('requires secured payment before service start or completion', () => {
    expect(
      bookingPaymentRequiredForStatus(
        { status: PaymentStatus.UNPAID },
        BookingStatus.ONGOING
      )
    ).toBe(true);
    expect(
      bookingPaymentRequiredForStatus(
        { status: PaymentStatus.PAID_HELD },
        BookingStatus.COMPLETED
      )
    ).toBe(false);
    expect(
      bookingPaymentRequiredForStatus(
        { status: PaymentStatus.PAID_HELD },
        BookingStatus.ACCEPTED
      )
    ).toBe(false);
  });
});
