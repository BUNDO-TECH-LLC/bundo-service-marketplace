import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import type { ActionRunner } from '../appTypes';
import type { Review } from '../types';
import { EmptyState } from '../components/EmptyState';

type AdminReview = Review & {
  customer?: { email?: string | null; phone?: string | null };
  artisan?: { displayName?: string };
  booking?: { offering?: { title?: string } };
};

export function AdminReviewsPanel({
  token,
  busy,
  runAction,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
}) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadReviews() {
    const response = await api<{ reviews: AdminReview[] }>('/admin/reviews?limit=100', { token });
    setReviews(response.reviews);
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadReviews()
      .catch(() => {
        if (mounted) setReviews([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function removeReview(reviewId: string) {
    await api(`/admin/reviews/${reviewId}`, {
      method: 'DELETE',
      token,
    });
    await loadReviews();
  }

  return (
    <section className="admin-panel">
      <p className="admin-panel-lead muted">Remove reviews that violate policy or contain abusive content.</p>

      {loading && <p className="muted">Loading reviews…</p>}
      {!loading && reviews.length === 0 && (
        <EmptyState title="No reviews yet" body="Customer reviews will appear here for moderation." />
      )}

      <div className="admin-inline-table" role="list">
        {reviews.map((review) => (
          <article className="admin-row" key={review.id} role="listitem">
            <div className="admin-row-grid">
              <div className="admin-row-primary">
                <strong className="admin-row-title">
                  {review.rating}/5 · {review.artisan?.displayName || 'Artisan'}
                </strong>
                <p className="admin-row-sub">
                  {review.customer?.email || review.customer?.phone || 'Customer'} ·{' '}
                  {review.booking?.offering?.title || 'Booking'}
                </p>
                {review.comment && <p className="admin-row-note">{review.comment}</p>}
                <span className="muted">{bookingDate(review.createdAt)}</span>
              </div>
            </div>
            <div className="admin-row-actions admin-row-actions--inline">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => removeReview(review.id), 'Review removed')}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
