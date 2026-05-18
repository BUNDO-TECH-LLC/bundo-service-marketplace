import type { PaymentSuccessState } from '../appTypes';
import { money } from '../lib/formatting';

export function PaymentSuccessDialog({
  payment,
  onClose,
  onViewBookings,
}: {
  payment: PaymentSuccessState;
  onClose: () => void;
  onViewBookings: () => void;
}) {
  return (
    <div className="success-overlay" role="presentation" onClick={onClose}>
      <section
        className="booking-success-dialog payment-success-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-success-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="success-mark" aria-hidden="true">
          ✓
        </span>
        <p className="eyebrow">Payment received</p>
        <h2 id="payment-success-title">Your payment is secured</h2>
        <p>
          We received {money(payment.amount)} for <strong>{payment.serviceTitle}</strong> with{' '}
          {payment.artisanName}. The funds are held safely until the job is completed.
        </p>
        <small>Booking #{payment.bookingId.slice(0, 8)}</small>
        <div className="booking-success-actions">
          <button type="button" onClick={onViewBookings}>
            View bookings
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
