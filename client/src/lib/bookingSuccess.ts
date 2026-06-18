import type { BookingSuccessState } from '../appTypes';
import type { Booking } from '../types';

export async function completeBookingRequest(input: {
  booking: Booking;
  serviceTitle: string;
  artisanName: string;
  onBookingSuccess: (state: BookingSuccessState) => void;
  reloadPrivate: () => Promise<void>;
}) {
  input.onBookingSuccess({
    bookingId: input.booking.id,
    serviceTitle: input.serviceTitle,
    artisanName: input.artisanName,
  });

  await input.reloadPrivate().catch(() => undefined);
}
