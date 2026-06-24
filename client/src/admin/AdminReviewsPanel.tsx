import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import type { ActionRunner } from '../appTypes';
import type { Review } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { useAdminList } from '../hooks/useAdminList';
import { AdminTableScrollHint } from './AdminTableScrollHint';

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
  const {
    items: reviews,
    total,
    page,
    limit,
    loading,
    setPage,
    reload,
  } = useAdminList<AdminReview>({
    token,
    path: '/admin/reviews',
    limit: 20,
    select: (response) => (response.reviews as AdminReview[]) ?? [],
  });

  async function removeReview(reviewId: string) {
    await api(`/admin/reviews/${reviewId}`, {
      method: 'DELETE',
      token,
    });
    await reload();
  }

  return (
    <section className="admin-panel">
      <p className="admin-panel-lead muted">Remove reviews that violate policy or contain abusive content.</p>

      {loading && <p className="muted">Loading reviews…</p>}
      {!loading && reviews.length === 0 && (
        <EmptyState title="No reviews yet" body="Customer reviews will appear here for moderation." />
      )}

      {reviews.length > 0 && (
        <div className="admin-table-scroll-wrap">
          <AdminTableScrollHint />
          <table className="admin-reviews-table admin-data-table">
            <thead>
              <tr>
                <th scope="col">Rating</th>
                <th scope="col">Artisan</th>
                <th scope="col">Customer</th>
                <th scope="col">Service</th>
                <th scope="col">Comment</th>
                <th scope="col">Posted</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>{review.rating}/5</td>
                  <td>{review.artisan?.displayName || 'Artisan'}</td>
                  <td>{review.customer?.email || review.customer?.phone || 'Customer'}</td>
                  <td>{review.booking?.offering?.title || 'Booking'}</td>
                  <td className="admin-data-table-clip" title={review.comment || undefined}>
                    {review.comment || '—'}
                  </td>
                  <td className="admin-data-table-nowrap">{bookingDate(review.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button admin-data-table-action"
                      disabled={busy}
                      onClick={() => runAction(() => removeReview(review.id), 'Review removed')}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} limit={limit} total={total} busy={busy || loading} onPageChange={setPage} />
    </section>
  );
}
