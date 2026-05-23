import type { BookingSuccessState } from '../../appTypes';

export function BookingSuccessDialog({
  booking,
  onClose,
  onGoToMessages,
}: {
  booking: BookingSuccessState;
  onClose: () => void;
  onGoToMessages: () => void;
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
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">Booking request sent</p>
        <h2 id="booking-success-title">Your request is with {booking.artisanName}</h2>
        <p>
          We created a booking for {booking.serviceTitle}. You can message the artisan now,
          or continue browsing while the request stays active.
        </p>
        {booking.bookingId && <small>Booking #{booking.bookingId.slice(0, 8)}</small>}
        <div className="booking-success-actions">
          <button type="button" onClick={onGoToMessages}>Go to messages</button>
          <button type="button" className="secondary-button" onClick={onClose}>Continue browsing</button>
        </div>
      </section>
    </div>
  );
}

