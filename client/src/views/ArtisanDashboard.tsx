import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import { summarizeArtisanEarnings } from '../lib/artisanEarnings';
import { dayLabels, formatMessageTime, money } from '../lib/formatting';
import { userDisplayName } from '../lib/userDisplayName';
import type { ActionRunner } from '../appTypes';
import type { Artisan, ArtisanKycSubmission, AvailabilitySlot, Booking, PortfolioImage } from '../types';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';

export function ArtisanDashboard({
  token,
  bookings,
  firebaseUser,
  busy,
  runAction,
  refresh,
  openBookings,
  openMessages,
  openReviews,
  openProfile,
  openOffers,
}: {
  token: string;
  bookings: Booking[];
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  openBookings: () => void;
  openMessages: () => void;
  openReviews: () => void;
  openProfile: () => void;
  openOffers: () => void;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const displayName = profile?.displayName || firebaseUser?.displayName || userDisplayName(firebaseUser, null) || 'Artisan';
  const requestedBookings = bookings.filter((booking) => booking.status === 'REQUESTED');
  const activeBookings = bookings.filter((booking) => ['ACCEPTED', 'COMPLETED'].includes(booking.status));
  const isApproved = profile?.verifyStatus === 'APPROVED' && kycSubmission?.status === 'APPROVED';
  const earnings = summarizeArtisanEarnings(bookings);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]).then(([profileResponse, imageResponse, slotResponse, kycResponse]) => {
      if (!mounted) return;
      setProfile(profileResponse.profile || null);
      setPortfolioImages(imageResponse.images);
      setAvailabilitySlots(slotResponse.slots);
      setKycSubmission(kycResponse.submission);
    });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function updateBookingStatus(bookingId: string, status: 'ACCEPTED' | 'DECLINED' | 'COMPLETED') {
    await api(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  return (
    <>
      <section className="artisan-dashboard-hero">
        <div>
          <h1>Good morning, {displayName.split(' ')[0]}</h1>
          <p className="muted">
            {isApproved
              ? 'Your profile is approved. Manage jobs, service offers, messages, and reviews from here.'
              : 'Your profile is still being reviewed. Complete profile settings while admin approval is pending.'}
          </p>
        </div>
        <span className={`booking-status ${isApproved ? 'completed' : 'pending'}`}>
          {isApproved ? 'Approved' : kycSubmission?.status?.toLowerCase().replace(/_/g, ' ') || 'Pending review'}
        </span>
        {isApproved && portfolioImages.length < 3 && (
          <div className="payment-note artisan-photo-nudge">
            <strong>Add photos to your profile</strong>
            <span>
              Profiles with work samples get more bookings. Add photos from{' '}
              <button type="button" className="text-button" onClick={openProfile}>
                Profile settings
              </button>
              .
            </span>
          </div>
        )}
        <div className="artisan-stat-grid">
          <StatCard label="Total bookings" value={bookings.length} hint="All time" />
          <StatCard label="Ratings" value={`${profile?.avgRating || 0}/5.0`} hint={`${profile?.ratingCount || 0} reviews`} />
          <StatCard label="Active jobs" value={activeBookings.length} hint="This week" />
          <StatCard label="New requests" value={requestedBookings.length} hint="Needs your response" />
        </div>
      </section>

      <section className="artisan-dashboard-grid">
        <div className="artisan-request-stack">
          <div className="logged-section-head">
            <h2>New Requests</h2>
            <button type="button" onClick={openBookings}>view all</button>
          </div>
          {requestedBookings.length === 0 && <EmptyState title="No new requests" body="New booking requests will appear here." />}
          {requestedBookings.slice(0, 2).map((booking) => (
            <article className="artisan-request-card" key={booking.id}>
              <span className="recommended-avatar">{(booking.customerUser?.email || 'C').slice(0, 1).toUpperCase()}</span>
              <div>
                <h3>{booking.customerUser?.email?.split('@')[0] || 'Customer'}</h3>
                <small>{booking.offering?.title || 'Service request'}</small>
                <p>{bookingDate(booking.scheduledAt)} · {booking.artisan?.area || profile?.area || 'Lagos'}</p>
                <div className="actions">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => runAction(() => updateBookingStatus(booking.id, 'DECLINED'), 'Booking request declined')}
                  >
                    Decline
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => runAction(() => updateBookingStatus(booking.id, 'ACCEPTED'), 'Booking request accepted')}
                  >
                    Accept
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <aside className="artisan-side-stack">
          <article className="artisan-soft-card">
            <div className="logged-section-head">
              <h2>Availability</h2>
              <button type="button" onClick={openProfile}>Edit</button>
            </div>
            <div className="availability-dots">
              {dayLabels.slice(1).concat(dayLabels[0]).map((day, index) => {
                const dayIndex = index === 6 ? 0 : index + 1;
                return (
                  <span key={day} className={availabilitySlots.some((slot) => slot.dayOfWeek === dayIndex) ? 'active' : ''}>
                    {day.slice(0, 1)}
                  </span>
                );
              })}
            </div>
          </article>
          <article className="artisan-soft-card">
            <h2>This week</h2>
            <dl className="summary-list">
              <div><dt>Jobs Completed</dt><dd>{bookings.filter((booking) => booking.status === 'COMPLETED').length}</dd></div>
              <div><dt>Jobs Upcoming</dt><dd>{activeBookings.length}</dd></div>
              <div>
                <dt>Earnings</dt>
                <dd>
                  {money(earnings.paidOut)}
                  {earnings.pendingRelease > 0 && (
                    <small className="muted"> · {money(earnings.pendingRelease)} pending</small>
                  )}
                </dd>
              </div>
            </dl>
          </article>
          <article className="artisan-soft-card quick-links">
            <h2>Quick links</h2>
            <button onClick={openProfile}>Profile settings</button>
            <button onClick={openOffers}>Service offers</button>
            <button onClick={openMessages}>Messages</button>
            <button onClick={openReviews}>Reviews</button>
          </article>
        </aside>
      </section>
    </>
  );
}