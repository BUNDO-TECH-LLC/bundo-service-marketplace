import { useState } from 'react';
import { api } from '../lib/api';
import { formatMessageTime, money } from '../lib/formatting';
import { artisanProfileImageUrl } from '../lib/profileImage';
import { capitalizeLeadingCharacter } from '../lib/userDisplayName';
import {
  artisanExpertiseLabel,
  bookingCardDate,
  bookingCardLocation,
  bookingCardNotes,
  bookingContactName,
  bookingDate,
  bookingLocation,
  bookingTimeSlotLabel,
  customerBookingStatusLabel,
  statusLabel,
} from '../lib/bookingDisplay';
import type { ActionRunner } from '../appTypes';
import type { Booking } from '../types';
import { EmptyState } from '../components/EmptyState';
import { ProfileAvatar } from '../components/ui/ProfileAvatar';

export function BookingsSummary({ bookings, title = 'My bookings' }: { bookings: Booking[]; title?: string }) {
  return (
    <article className="panel-card">
      <p className="eyebrow">Customer</p>
      <h2>{title}</h2>
      {bookings.length === 0 && <p>No bookings yet.</p>}
      {bookings.map((booking) => (
        <div className="list-item" key={booking.id}>
          <strong>{booking.offering?.title || 'Booking'}</strong>
          <span>{booking.status}</span>
        </div>
      ))}
    </article>
  );
}

function ArtisanJobsPage({
  bookings,
  visibleBookings,
  selectedBooking,
  filter,
  tabs,
  busy,
  setFilter,
  selectBooking,
  openMessages,
  updateBookingStatus,
}: {
  bookings: Booking[];
  visibleBookings: Booking[];
  selectedBooking: Booking | null;
  filter: 'ALL' | Booking['status'];
  tabs: Array<{ label: string; value: 'ALL' | Booking['status'] }>;
  busy: boolean;
  setFilter: (filter: 'ALL' | Booking['status']) => void;
  selectBooking: (bookingId: string | null) => void;
  openMessages: () => void;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => Promise<void>;
}) {
  if (selectedBooking) {
    const isAccepted = selectedBooking.status === 'ACCEPTED';
    const customerName = bookingContactName(selectedBooking);
    const serviceName = selectedBooking.offering?.title || 'Basic inspection';

    return (
      <section className="artisan-job-detail-page">
        <div className="artisan-job-detail-head">
          <div>
            <h2>Active bookings</h2>
            <p>
              {isAccepted ? 'Accepted' : statusLabel(selectedBooking.status)} · Booking #
              {selectedBooking.id.slice(0, 6)}
            </p>
          </div>
          <span className={`booking-status ${selectedBooking.status.toLowerCase()}`}>
            {statusLabel(selectedBooking.status)}
          </span>
        </div>

        <div className="artisan-job-customer">
          <small>Customer</small>
          <div className="booking-person">
            <span>{customerName.slice(0, 1).toUpperCase()}</span>
            <div>
              <h3>{customerName}</h3>
              <p>{bookingLocation(selectedBooking)} · 3 past bookings</p>
            </div>
          </div>
        </div>

        <article className="artisan-job-detail-card">
          <h3>Booking Details</h3>
          <dl>
            <div>
              <dt>Service type</dt>
              <dd>{serviceName}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{bookingDate(selectedBooking.scheduledAt)}</dd>
            </div>
            <div>
              <dt>Time slot</dt>
              <dd>
                {selectedBooking.scheduledAt ? formatMessageTime(selectedBooking.scheduledAt) : 'To be confirmed'}
              </dd>
            </div>
            <div className="full">
              <dt>NOTE</dt>
              <dd>{selectedBooking.note || 'No note added'}</dd>
            </div>
          </dl>
        </article>

        <div className="artisan-job-actions">
          {selectedBooking.status === 'REQUESTED' && (
            <button disabled={busy} onClick={() => updateBookingStatus(selectedBooking.id, 'ACCEPTED')}>
              Accept request
            </button>
          )}
          {selectedBooking.status === 'ACCEPTED' && (
            <button disabled={busy} onClick={() => updateBookingStatus(selectedBooking.id, 'COMPLETED')}>
              Mark as completed
            </button>
          )}
          <button className="secondary-button" onClick={openMessages}>
            Open Chat
          </button>
          <button className="text-button" onClick={() => selectBooking(null)}>
            Back to jobs
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="artisan-jobs-page">
      <div className="artisan-jobs-head">
        <h2>Active bookings</h2>
        <p>You have {bookings.length} Active bookings</p>
      </div>
      <div className="booking-tabs artisan-tabs" role="tablist" aria-label="Booking filters">
        {tabs.map((tab) => (
          <button key={tab.value} className={filter === tab.value ? 'active' : ''} onClick={() => setFilter(tab.value)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="artisan-job-list">
        {visibleBookings.length === 0 && (
          <EmptyState title="No jobs here" body="Bookings matching this status will appear here." />
        )}
        {visibleBookings.map((booking) => {
          const customerName = bookingContactName(booking);
          return (
            <article className="artisan-job-row" key={booking.id}>
              <div className="booking-person">
                <span>{customerName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3>{customerName}</h3>
                  <p>{booking.offering?.title || 'Service booking'}</p>
                </div>
              </div>
              <p>
                {bookingDate(booking.scheduledAt)} · {bookingLocation(booking)}
              </p>
              <span className={`booking-status ${booking.status.toLowerCase()}`}>{statusLabel(booking.status)}</span>
              <button onClick={() => selectBooking(booking.id)}>
                {booking.status === 'REQUESTED' ? 'View booking request' : 'View active bookings'}
              </button>
              <button className="secondary-button" onClick={openMessages}>
                Open Chat
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function BookingsPage({
  bookings,
  mode,
  token,
  busy,
  runAction,
  refresh,
  openMessages,
}: {
  bookings: Booking[];
  mode: 'customer' | 'artisan';
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  openMessages: () => void;
}) {
  const [filter, setFilter] = useState<'ALL' | Booking['status']>('ALL');
  const tabs: Array<{ label: string; value: 'ALL' | Booking['status'] }> = [
    { label: 'All', value: 'ALL' },
    { label: 'Pending', value: 'REQUESTED' },
    { label: 'Accepted', value: 'ACCEPTED' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Declined', value: 'DECLINED' },
  ];
  const visibleBookings = filter === 'ALL' ? bookings : bookings.filter((booking) => booking.status === filter);
  const [selectedArtisanBookingId, setSelectedArtisanBookingId] = useState<string | null>(null);
  const selectedArtisanBooking = bookings.find((booking) => booking.id === selectedArtisanBookingId) || null;

  async function cancelBooking(bookingId: string) {
    await api(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      token,
    });
    await refresh();
  }

  async function updateBookingStatus(bookingId: string, status: Booking['status']) {
    await api(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function startPayment(bookingId: string) {
    const response = await api<{ authorizationUrl?: string }>('/payments/initialize', {
      method: 'POST',
      token,
      body: JSON.stringify({ bookingId }),
    });

    if (response.authorizationUrl) {
      window.location.href = response.authorizationUrl;
      return;
    }

    await refresh();
  }

  if (mode === 'artisan') {
    return (
      <ArtisanJobsPage
        bookings={bookings}
        visibleBookings={visibleBookings}
        selectedBooking={selectedArtisanBooking}
        filter={filter}
        tabs={tabs}
        busy={busy}
        setFilter={setFilter}
        selectBooking={setSelectedArtisanBookingId}
        openMessages={openMessages}
        updateBookingStatus={(bookingId, status) =>
          runAction(() => updateBookingStatus(bookingId, status), `Booking ${status.toLowerCase()}`)
        }
      />
    );
  }

  return (
    <section className="bookings-page">
      <h1 className="bookings-page-title">Booking details</h1>

      <div className="booking-tabs" role="tablist" aria-label="Booking filters">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={filter === tab.value ? 'active' : ''}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visibleBookings.length === 0 && (
        <EmptyState
          title="No bookings yet"
          body="Your service bookings will appear here after you request a service."
        />
      )}

      <div className="booking-list">
        {visibleBookings.map((booking) => {
          const contactName = capitalizeLeadingCharacter(
            booking.artisan?.displayName || booking.offering?.artisan?.displayName || 'Bundo professional'
          );
          const contactImageUrl = artisanProfileImageUrl(booking.artisan || booking.offering?.artisan);
          const serviceName = booking.offering?.title || 'Service booking';
          const price = booking.offering?.priceFrom ? money(booking.offering.priceFrom) : 'To be confirmed';
          const paymentStatus = booking.payment?.status;
          const canPay =
            booking.status === 'ACCEPTED' &&
            (!paymentStatus || ['UNPAID', 'PAYMENT_PENDING', 'FAILED'].includes(paymentStatus));
          const canCancel = ['REQUESTED', 'ACCEPTED'].includes(booking.status);

          return (
            <article className="booking-detail-card" key={booking.id}>
              <header className="booking-detail-head">
                <div className="booking-person">
                  <ProfileAvatar
                    name={contactName}
                    imageUrl={contactImageUrl}
                    className="h-11 w-11"
                    textClassName="text-sm"
                  />
                  <div>
                    <h3>{contactName}</h3>
                    <p>{artisanExpertiseLabel(booking)}</p>
                  </div>
                </div>
                <span className={`booking-status ${booking.status.toLowerCase()}`}>
                  {customerBookingStatusLabel(booking.status)}
                </span>
              </header>

              <dl className="booking-detail-list">
                <div>
                  <dt>Service</dt>
                  <dd>{serviceName}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{bookingCardDate(booking.scheduledAt)}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{bookingTimeSlotLabel(booking.scheduledAt)}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{bookingCardLocation(booking)}</dd>
                </div>
                <div className="booking-detail-notes">
                  <dt>Notes</dt>
                  <dd>{bookingCardNotes(booking.note)}</dd>
                </div>
              </dl>

              <div className="booking-total-row">
                <span>Estimated total</span>
                <strong>{price}</strong>
              </div>

              {booking.status === 'ACCEPTED' ? (
                <div className="booking-card-action-stack">
                  {canPay ? (
                    <button
                      type="button"
                      className="booking-card-primary-action"
                      disabled={busy}
                      onClick={() => runAction(() => startPayment(booking.id), 'Payment checkout opened')}
                    >
                      Pay securely
                    </button>
                  ) : null}
                  {paymentStatus === 'PAID_HELD' ? (
                    <button type="button" className="booking-card-primary-action" disabled>
                      Payment secured
                    </button>
                  ) : null}
                  <button type="button" className="booking-card-secondary-action" onClick={openMessages}>
                    Open Chat
                  </button>
                </div>
              ) : null}
              {booking.status === 'COMPLETED' ? (
                <button
                  type="button"
                  className="booking-card-primary-action"
                  disabled={busy}
                  onClick={() =>
                    runAction(async () => undefined, 'Reviews are created from completed booking flow')
                  }
                >
                  Leave a review
                </button>
              ) : null}
              {booking.status !== 'ACCEPTED' && booking.status !== 'COMPLETED' ? (
                <button
                  type="button"
                  className="booking-card-primary-action"
                  disabled={busy || !canCancel}
                  onClick={() => runAction(() => cancelBooking(booking.id), 'Booking cancelled')}
                >
                  Cancel request
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
