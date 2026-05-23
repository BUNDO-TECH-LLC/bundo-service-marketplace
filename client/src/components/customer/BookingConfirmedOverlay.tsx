import { AppIcon } from '../ui/AppIcon';
import { formatBookingConfirmedDateTime } from '../../lib/bookingDisplay';

export type BookingConfirmedDetails = {
  bookingId: string;
  artisanName: string;
  serviceTitle: string;
  scheduledAt: string;
  location: string;
};

type BookingConfirmedOverlayProps = {
  details: BookingConfirmedDetails;
  messageLabel?: string;
  contactLabel?: string;
  onMessage: () => void;
  onViewDetails: () => void;
  busy?: boolean;
};

export function BookingConfirmedOverlay({
  details,
  messageLabel = 'Message Artisan',
  contactLabel = 'Artisan',
  onMessage,
  onViewDetails,
  busy = false,
}: BookingConfirmedOverlayProps) {
  return (
    <div className="book-job-success-overlay" role="presentation">
      <div
        className="book-job-success-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-confirmed-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="book-job-success-mark" aria-hidden="true">
          <AppIcon icon="mdi:check" size={34} />
        </span>

        <h2 id="booking-confirmed-title" className="book-job-success-title">
          Booking Confirmed
        </h2>

        <dl className="book-job-success-summary">
          <div className="book-job-success-summary__row">
            <dt>{contactLabel}</dt>
            <dd>{details.artisanName}</dd>
          </div>
          <div className="book-job-success-summary__row">
            <dt>Service</dt>
            <dd>{details.serviceTitle}</dd>
          </div>
          <div className="book-job-success-summary__row">
            <dt>Date &amp; time</dt>
            <dd>{formatBookingConfirmedDateTime(details.scheduledAt)}</dd>
          </div>
          <div className="book-job-success-summary__row">
            <dt>Location</dt>
            <dd>{details.location}</dd>
          </div>
        </dl>

        <div className="book-job-success-actions">
          <button
            type="button"
            className="book-job-success-btn book-job-success-btn--primary"
            disabled={busy}
            onClick={onMessage}
          >
            {messageLabel}
          </button>
          <button
            type="button"
            className="book-job-success-btn book-job-success-btn--secondary"
            disabled={busy}
            onClick={onViewDetails}
          >
            View booking details
          </button>
        </div>
      </div>
    </div>
  );
}
