import { BookingStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { canTransitionBookingStatus } from './bookingStatus';

describe('canTransitionBookingStatus', () => {
  it('allows artisan to accept a request and progress the job', () => {
    expect(
      canTransitionBookingStatus(
        BookingStatus.REQUESTED,
        BookingStatus.ACCEPTED,
        'artisan'
      )
    ).toBe(true);
    expect(
      canTransitionBookingStatus(BookingStatus.ACCEPTED, BookingStatus.ONGOING, 'artisan')
    ).toBe(true);
    expect(
      canTransitionBookingStatus(BookingStatus.ONGOING, BookingStatus.COMPLETED, 'artisan')
    ).toBe(true);
  });

  it('blocks invalid artisan transitions', () => {
    expect(
      canTransitionBookingStatus(
        BookingStatus.REQUESTED,
        BookingStatus.COMPLETED,
        'artisan'
      )
    ).toBe(false);
    expect(
      canTransitionBookingStatus(BookingStatus.COMPLETED, BookingStatus.ONGOING, 'artisan')
    ).toBe(false);
  });

  it('allows admin to confirm appointments and update active jobs', () => {
    expect(
      canTransitionBookingStatus(
        BookingStatus.REQUESTED,
        BookingStatus.ACCEPTED,
        'admin'
      )
    ).toBe(true);
    expect(
      canTransitionBookingStatus(BookingStatus.ACCEPTED, BookingStatus.ONGOING, 'admin')
    ).toBe(true);
    expect(
      canTransitionBookingStatus(BookingStatus.ONGOING, BookingStatus.COMPLETED, 'admin')
    ).toBe(true);
  });
});
