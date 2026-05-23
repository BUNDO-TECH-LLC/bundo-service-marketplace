import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { bookingDate } from '../../lib/bookingDisplay';
import { EmptyState } from '../../components/EmptyState';
import type { Artisan, Review } from '../../types';

export function ArtisanReviewsPage({ token }: { token: string }) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let mounted = true;

    api<{ profile: Artisan }>('/artisans/me', { token })
      .then(async (profileResponse) => {
        const reviewResponse = await api<{ reviews: Review[] }>(`/artisans/${profileResponse.profile.id}/reviews`);

        if (!mounted) {
          return;
        }

        setProfile(profileResponse.profile);
        setReviews(reviewResponse.reviews);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setProfile(null);
        setReviews([]);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const average = profile?.avgRating || 0;

  return (
    <section className="artisan-reviews-page">
      <h2>Reviews</h2>
      <div className="reviews-summary">
        <div className="reviews-score">
          <strong>{average.toFixed(1)}</strong>
          <span>★★★★★</span>
          <p>{reviews.length ? 'Based on customer reviews' : 'No reviews yet'}</p>
        </div>
        <div className="reviews-bars">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = reviews.filter((review) => review.rating === rating).length;
            const percent = reviews.length ? (count / reviews.length) * 100 : 0;

            return (
              <div key={rating}>
                <span>{rating} Stars</span>
                <i>
                  <b style={{ width: `${percent}%` }} />
                </i>
                <small>{count}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="reviews-list">
        {reviews.length === 0 ? <EmptyState title="No reviews yet" body="Reviews from completed jobs will appear here." /> : null}
        {reviews.map((review) => (
          <article className="review-card artisan-review-card" key={review.id}>
            <div className="review-head">
              <span className="recommended-avatar">{(review.customer?.email || 'C').slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{review.customer?.email?.split('@')[0] || 'Customer'}</strong>
                <span className="verified-hire">Verified hire</span>
                <p>
                  {'★'.repeat(review.rating)} <small>{bookingDate(review.createdAt)}</small>
                </p>
              </div>
            </div>
            <p>{review.comment || 'Customer left a rating for this completed job.'}</p>
            <small>JOB: {review.booking?.offering?.title || 'Service booking'}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
