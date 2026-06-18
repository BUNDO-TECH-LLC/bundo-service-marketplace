import type { BookingSuccessState } from '../../appTypes';

export function BookingSuccessDialog({
  booking,
  onClose,
  onGoToMessages,
  onViewBookings,
}: {
  booking: BookingSuccessState;
  onClose: () => void;
  onGoToMessages: () => void;
  onViewBookings: () => void;
}) {
  return (
    <div className="success-overlay" role="presentation" onClick={onClose}>
      <section
        className="booking-success-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="success-mark" aria-hidden="true">
          ✓
        </span>
        <p className="eyebrow">Booking confirmed</p>
        <h2 id="booking-success-title">Your request is with {booking.artisanName}</h2>
        <p>
          We saved your booking for {booking.serviceTitle}. Track it under <strong>Pending</strong>{' '}
          until the artisan accepts, or message them now with any details.
        </p>
        {booking.bookingId && <small>Booking #{booking.bookingId.slice(0, 8)}</small>}
        <div className="booking-success-actions">
          <button type="button" onClick={onViewBookings}>
            View my booking
          </button>
          <button type="button" className="secondary-button" onClick={onGoToMessages}>
            Go to messages
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Continue browsing
          </button>
        </div>
      </section>
    </div>
  );
}
