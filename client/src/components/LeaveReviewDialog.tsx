import { FormEvent, useState } from 'react';
import type { Booking } from '../types';

export function LeaveReviewDialog({
  booking,
  busy,
  onClose,
  onSubmit,
}: {
  booking: Booking;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { rating: number; comment: string }) => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const artisanName = booking.artisan?.displayName || booking.offering?.artisan?.displayName || 'your artisan';
  const serviceName = booking.offering?.title || 'this service';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({ rating, comment: comment.trim() });
  }

  return (
    <div className="success-overlay" role="presentation" onClick={onClose}>
      <form
        className="booking-success-dialog review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-review-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <p className="eyebrow">Leave a review</p>
        <h2 id="leave-review-title">How was {serviceName}?</h2>
        <p>Share your experience with {artisanName}. Reviews help other customers choose trusted professionals.</p>

        <fieldset className="review-rating-field">
          <legend>Rating</legend>
          <div className="review-star-row" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= rating ? 'active' : ''}
                disabled={busy}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                onClick={() => setRating(value)}
              >
                ★
              </button>
            ))}
          </div>
        </fieldset>

        <label className="review-comment-field">
          <span>Comment (optional)</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What went well? Anything future customers should know?"
            rows={4}
            maxLength={2000}
            disabled={busy}
          />
        </label>

        <div className="booking-success-actions">
          <button type="submit" disabled={busy}>
            Submit review
          </button>
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
