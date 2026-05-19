import type { Booking } from '../types';

export function summarizeArtisanEarnings(bookings: Booking[]) {
  let paidOut = 0;
  let pendingRelease = 0;

  for (const booking of bookings) {
    const sentPayout = booking.payouts?.find((payout) => payout.status === 'SENT');
    if (sentPayout) {
      paidOut += sentPayout.amount;
      continue;
    }

    if (
      booking.status === 'COMPLETED' &&
      booking.payment &&
      ['PAID_HELD', 'PARTIALLY_REFUNDED'].includes(booking.payment.status)
    ) {
      pendingRelease += booking.payment.providerEarning;
    }
  }

  return { paidOut, pendingRelease };
}
