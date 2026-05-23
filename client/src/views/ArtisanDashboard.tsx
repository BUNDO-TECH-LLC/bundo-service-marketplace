import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { api } from '../lib/api';
import { bookingContactName, bookingDate, bookingLocation, statusLabel } from '../lib/bookingDisplay';
import { summarizeArtisanEarnings } from '../lib/artisanEarnings';
import { dayLabels, money } from '../lib/formatting';
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
  openProfile,
  openBookingDetail,
}: {
  token: string;
  bookings: Booking[];
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  openBookings: () => void;
  openProfile: () => void;
  openBookingDetail: (bookingId: string) => void;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const displayName = profile?.displayName || firebaseUser?.displayName || userDisplayName(firebaseUser, null) || 'Artisan';
  const requestedBookings = bookings.filter((booking) => booking.status === 'REQUESTED');
  const activeJobs = bookings.filter((booking) => ['ACCEPTED', 'ONGOING'].includes(booking.status));
  const completedThisWeek = bookings.filter((booking) => booking.status === 'COMPLETED').length;
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
    <section className="artisan-dashboard-page">
      <header className="artisan-dashboard-hero">
        <div className="artisan-dashboard-hero-top">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Good morning, {displayName.split(' ')[0]}</h1>
            <p className="muted">
              {isApproved
                ? 'Review new requests, track active jobs, and keep your profile up to date.'
                : 'Your profile is still being reviewed. You can still prepare offers and respond when bookings arrive.'}
            </p>
          </div>
          <span className={`booking-status ${isApproved ? 'completed' : 'pending'}`}>
            {isApproved ? 'Approved' : kycSubmission?.status?.toLowerCase().replace(/_/g, ' ') || 'Pending review'}
          </span>
        </div>

        {isApproved && portfolioImages.length < 3 && (
          <div className="payment-note artisan-photo-nudge">
            <strong>Add photos to your profile</strong>
            <span>
              Profiles with work samples get more bookings. Add photos from{' '}
              <button type="button" className="text-button" onClick={openProfile}>
                your profile
              </button>
              .
            </span>
          </div>
        )}

        <div className="artisan-stat-grid">
          <StatCard label="Total bookings" value={bookings.length} hint="All time" />
          <StatCard label="Ratings" value={`${profile?.avgRating || 0}/5.0`} hint={`${profile?.ratingCount || 0} reviews`} />
          <StatCard label="Active jobs" value={activeJobs.length} hint="In progress" />
          <StatCard label="New requests" value={requestedBookings.length} hint="Needs response" />
        </div>
      </header>

      <div className="artisan-dashboard-grid">
        <div className="artisan-dashboard-main">
          <section className="artisan-dashboard-section">
            <div className="logged-section-head">
              <h2>New requests</h2>
              {requestedBookings.length > 0 && (
                <button type="button" className="text-button" onClick={openBookings}>
                  View all
                </button>
              )}
            </div>
            {requestedBookings.length === 0 ? (
              <EmptyState title="No new requests" body="New booking requests will appear here." />
            ) : (
              <div className="artisan-dashboard-card-stack">
                {requestedBookings.slice(0, 3).map((booking) => (
                  <article className="artisan-request-card" key={booking.id}>
                    <span className="recommended-avatar">
                      {(booking.customerUser?.email || 'C').slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div className="artisan-request-card-head">
                        <div>
                          <h3>{bookingContactName(booking)}</h3>
                          <small>{booking.offering?.title || 'Service request'}</small>
                        </div>
                        <span className="booking-status requested">{statusLabel(booking.status)}</span>
                      </div>
                      <p>
                        {bookingDate(booking.scheduledAt)} · {bookingLocation(booking)}
                      </p>
                      <div className="actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => openBookingDetail(booking.id)}
                        >
                          View details
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => runAction(() => updateBookingStatus(booking.id, 'DECLINED'), 'Booking request declined')}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
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
            )}
          </section>

          <section className="artisan-dashboard-section">
            <div className="logged-section-head">
              <h2>Active jobs</h2>
              {activeJobs.length > 0 && (
                <button type="button" className="text-button" onClick={openBookings}>
                  View all jobs
                </button>
              )}
            </div>
            {activeJobs.length === 0 ? (
              <EmptyState title="No active jobs" body="Accepted and in-progress jobs will show up here." />
            ) : (
              <div className="artisan-dashboard-card-stack">
                {activeJobs.slice(0, 4).map((booking) => (
                  <article className="artisan-job-preview-card" key={booking.id}>
                    <div className="artisan-job-preview-main">
                      <span className="recommended-avatar">
                        {bookingContactName(booking).slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <h3>{booking.offering?.title || 'Service booking'}</h3>
                        <p>{bookingContactName(booking)}</p>
                        <p className="muted">
                          {bookingDate(booking.scheduledAt)} · {bookingLocation(booking)}
                        </p>
                      </div>
                    </div>
                    <div className="artisan-job-preview-actions">
                      <span className={`booking-status ${booking.status.toLowerCase()}`}>
                        {statusLabel(booking.status)}
                      </span>
                      <button type="button" onClick={() => openBookingDetail(booking.id)}>
                        View details
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="artisan-side-stack">
          <article className="artisan-soft-card">
            <div className="logged-section-head">
              <h2>Availability</h2>
              <button type="button" className="text-button" onClick={openProfile}>
                Edit
              </button>
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
              <div>
                <dt>Jobs completed</dt>
                <dd>{completedThisWeek}</dd>
              </div>
              <div>
                <dt>Jobs upcoming</dt>
                <dd>{activeJobs.length}</dd>
              </div>
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
        </aside>
      </div>
    </section>
  );
}
