import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LeaveReviewDialog } from '../components/LeaveReviewDialog';
import { PromptDialog } from '../components/PromptDialog';
import { api } from '../lib/api';
import { formatMessageTime, money } from '../lib/formatting';
import {
  agreedAmountInputValue,
  bookingContactName,
  bookingDate,
  bookingGuidePrice,
  bookingInputValue,
  bookingLocation,
  bookingPayableAmount,
  MIN_PAYMENT_AMOUNT_NGN,
  parseAgreedAmountInput,
  parseBookingInput,
  paymentLabel,
  statusLabel,
} from '../lib/bookingDisplay';
import {
  canLeaveReview,
  canStartOrCompleteBooking,
  isBookingPaymentSecured,
} from '../lib/bookingPayment';
import type { ActionRunner } from '../appTypes';
import type { Booking } from '../types';
import { EmptyState } from '../components/EmptyState';

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
    const customerName = bookingContactName(selectedBooking);
    const serviceName = selectedBooking.offering?.title || 'Basic inspection';

    return (
      <section className="artisan-job-detail-page">
        <div className="artisan-job-detail-head">
          <div>
            <h2>Job details</h2>
            <p>
              {statusLabel(selectedBooking.status)} · Booking #{selectedBooking.id.slice(0, 6).toUpperCase()}
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
            {bookingGuidePrice(selectedBooking) !== null && (
              <div>
                <dt>Guide price</dt>
                <dd>{money(bookingGuidePrice(selectedBooking)!)}</dd>
              </div>
            )}
            {bookingPayableAmount(selectedBooking) !== null && (
              <div>
                <dt>Agreed amount</dt>
                <dd>{money(bookingPayableAmount(selectedBooking)!)}</dd>
              </div>
            )}
          </dl>
        </article>

        <div className="artisan-job-actions">
          {!canStartOrCompleteBooking(selectedBooking) &&
            ['ACCEPTED', 'ONGOING'].includes(selectedBooking.status) && (
              <p className="booking-payment-notice" role="status">
                Waiting for customer payment via Paystack. The service cannot start or be completed until
                payment is secured.
              </p>
            )}
          {selectedBooking.status === 'REQUESTED' && (
            <button disabled={busy} onClick={() => updateBookingStatus(selectedBooking.id, 'ACCEPTED')}>
              Accept request
            </button>
          )}
          {selectedBooking.status === 'ACCEPTED' && (
            <button
              disabled={busy || !canStartOrCompleteBooking(selectedBooking)}
              onClick={() => updateBookingStatus(selectedBooking.id, 'ONGOING')}
            >
              Start service
            </button>
          )}
          {(selectedBooking.status === 'ACCEPTED' || selectedBooking.status === 'ONGOING') && (
            <button
              disabled={busy || !canStartOrCompleteBooking(selectedBooking)}
              onClick={() => updateBookingStatus(selectedBooking.id, 'COMPLETED')}
            >
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<'ALL' | Booking['status']>('ALL');
  const tabs: Array<{ label: string; value: 'ALL' | Booking['status'] }> = [
    { label: 'All', value: 'ALL' },
    { label: 'Pending', value: 'REQUESTED' },
    { label: 'Accepted', value: 'ACCEPTED' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Declined', value: 'DECLINED' },
  ];
  const visibleBookings = filter === 'ALL' ? bookings : bookings.filter((booking) => booking.status === filter);
  const jobIdFromUrl = searchParams.get('job');
  const [selectedArtisanBookingId, setSelectedArtisanBookingId] = useState<string | null>(() => jobIdFromUrl);
  const selectedArtisanBooking = bookings.find((booking) => booking.id === selectedArtisanBookingId) || null;

  useEffect(() => {
    if (mode !== 'artisan') {
      return;
    }
    if (!jobIdFromUrl) {
      setSelectedArtisanBookingId(null);
      return;
    }
    if (bookings.some((booking) => booking.id === jobIdFromUrl)) {
      setSelectedArtisanBookingId(jobIdFromUrl);
      return;
    }
    setSelectedArtisanBookingId(null);
    setSearchParams({}, { replace: true });
  }, [mode, jobIdFromUrl, bookings, setSearchParams]);

  function selectArtisanBooking(bookingId: string | null) {
    setSelectedArtisanBookingId(bookingId);
    if (bookingId) {
      setSearchParams({ job: bookingId }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  }

  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reschedulePrompt, setReschedulePrompt] = useState<null | {
    booking: Booking;
    step: 'datetime' | 'note';
    scheduledAt?: string;
  }>(null);
  const [paymentPrompt, setPaymentPrompt] = useState<Booking | null>(null);

  async function submitReview(input: { rating: number; comment: string }) {
    if (!reviewBooking) return;
    await api('/reviews', {
      method: 'POST',
      token,
      body: JSON.stringify({
        bookingId: reviewBooking.id,
        rating: input.rating,
        comment: input.comment || undefined,
      }),
    });
    setReviewBooking(null);
    await refresh();
  }

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

  async function startPayment(bookingId: string, amount: number) {
    const response = await api<{ authorizationUrl?: string }>('/payments/initialize', {
      method: 'POST',
      token,
      body: JSON.stringify({ bookingId, amount }),
    });

    if (response.authorizationUrl) {
      setPaymentPrompt(null);
      window.location.href = response.authorizationUrl;
      return;
    }

    setPaymentPrompt(null);
    await refresh();
  }

  async function submitPaymentAmount(raw: string) {
    if (!paymentPrompt) {
      return;
    }

    const amount = parseAgreedAmountInput(raw);
    if (!amount || amount < MIN_PAYMENT_AMOUNT_NGN) {
      throw new Error(
        `Enter a valid amount in naira (minimum ₦${MIN_PAYMENT_AMOUNT_NGN.toLocaleString('en-NG')}).`
      );
    }

    await startPayment(paymentPrompt.id, amount);
  }

  async function openDispute(bookingId: string) {
    await api(`/bookings/${bookingId}/dispute`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        reason: 'Customer requested admin review from the bookings page',
      }),
    });
    await refresh();
  }

  function startReschedule(booking: Booking) {
    setReschedulePrompt({ booking, step: 'datetime' });
  }

  async function submitReschedule(input: string) {
    if (!reschedulePrompt) return;

    if (reschedulePrompt.step === 'datetime') {
      const parsed = parseBookingInput(input);
      if (!parsed) {
        throw new Error('Please enter a valid date and time like 2026-05-15 14:30');
      }
      setReschedulePrompt({
        booking: reschedulePrompt.booking,
        step: 'note',
        scheduledAt: parsed.toISOString(),
      });
      return;
    }

    await api(`/bookings/${reschedulePrompt.booking.id}/reschedule`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        scheduledAt: reschedulePrompt.scheduledAt,
        note: input || reschedulePrompt.booking.note,
      }),
    });
    setReschedulePrompt(null);
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
        selectBooking={selectArtisanBooking}
        openMessages={openMessages}
        updateBookingStatus={(bookingId, status) =>
          runAction(() => updateBookingStatus(bookingId, status), `Booking ${status.toLowerCase()}`)
        }
      />
    );
  }

  return (
    <>
    {reviewBooking && (
      <LeaveReviewDialog
        booking={reviewBooking}
        busy={busy}
        onClose={() => setReviewBooking(null)}
        onSubmit={(input) => runAction(() => submitReview(input), 'Review submitted')}
      />
    )}
    <PromptDialog
      open={paymentPrompt !== null}
      title="Confirm payment amount"
      message={
        paymentPrompt && bookingGuidePrice(paymentPrompt) !== null
          ? `The listing price (${money(bookingGuidePrice(paymentPrompt)!)}) is a guide. Enter the amount you agreed on with ${paymentPrompt.artisan?.displayName || 'your artisan'} (minimum ₦${MIN_PAYMENT_AMOUNT_NGN.toLocaleString('en-NG')}).`
          : `Enter the amount you agreed on with your artisan (minimum ₦${MIN_PAYMENT_AMOUNT_NGN.toLocaleString('en-NG')}).`
      }
      label="Amount to pay (₦)"
      defaultValue={paymentPrompt ? agreedAmountInputValue(paymentPrompt) : ''}
      inputType="number"
      confirmLabel="Continue to Paystack"
      busy={busy}
      onCancel={() => setPaymentPrompt(null)}
      onConfirm={(value) => runAction(() => submitPaymentAmount(value), 'Payment checkout opened')}
    />
    <PromptDialog
      open={reschedulePrompt !== null}
      title={reschedulePrompt?.step === 'note' ? 'Reschedule note' : 'Reschedule booking'}
      message={
        reschedulePrompt?.step === 'datetime'
          ? 'Enter the new date and time (YYYY-MM-DD HH:MM).'
          : 'Optional note for the artisan.'
      }
      label={reschedulePrompt?.step === 'datetime' ? 'Date and time' : 'Note'}
      defaultValue={
        reschedulePrompt?.step === 'datetime'
          ? bookingInputValue(reschedulePrompt.booking.scheduledAt)
          : reschedulePrompt?.booking.note || ''
      }
      busy={busy}
      onCancel={() => setReschedulePrompt(null)}
      onConfirm={(value) => runAction(() => submitReschedule(value), 'Booking rescheduled')}
    />
    <section className="bookings-page">
      <div className="bookings-toolbar">
        <div>
          <p className="eyebrow">Booking details</p>
          <h2>My bookings</h2>
        </div>
        <span>{bookings.length} total</span>
      </div>

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
          const contactName =
            booking.artisan?.displayName || booking.offering?.artisan?.displayName || 'Bundo professional';
          const contactInitials = contactName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const serviceName = booking.offering?.title || 'Service booking';
          const guidePrice = bookingGuidePrice(booking);
          const payableAmount = bookingPayableAmount(booking);
          const priceLabel =
            payableAmount !== null && guidePrice !== null && payableAmount !== guidePrice
              ? 'Agreed amount'
              : payableAmount !== null
                ? 'Amount'
                : 'Guide price';
          const price =
            payableAmount !== null
              ? money(payableAmount)
              : guidePrice !== null
                ? money(guidePrice)
                : 'To be confirmed';
          const paymentStatus = booking.payment?.status;
          const latestDispute = booking.disputes?.[0];
          const paymentSecured = isBookingPaymentSecured(paymentStatus);
          const canPay =
            mode === 'customer' &&
            !['CANCELLED', 'DECLINED', 'COMPLETED'].includes(booking.status) &&
            !paymentSecured;
          const awaitingPaymentToStart =
            mode === 'customer' &&
            booking.status === 'ACCEPTED' &&
            !paymentSecured;
          const canDispute =
            mode === 'customer' &&
            paymentStatus === 'PAID_HELD' &&
            !booking.disputes?.some((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW');

          return (
            <article className="booking-detail-card" key={booking.id}>
              <header className="booking-detail-head">
                <div className="booking-person">
                  <span>{contactInitials}</span>
                  <div>
                    <h3>{contactName}</h3>
                    <p>{booking.offering?.category?.name || serviceName}</p>
                  </div>
                </div>
                <span className={`booking-status ${booking.status.toLowerCase()}`}>{statusLabel(booking.status)}</span>
              </header>

              <dl className="booking-detail-list">
                <div>
                  <dt>Service</dt>
                  <dd>{serviceName}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{bookingDate(booking.scheduledAt)}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{booking.scheduledAt ? formatMessageTime(booking.scheduledAt) : 'To be confirmed'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{booking.artisan?.area || booking.offering?.artisan?.area || 'To be confirmed'}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{booking.note || 'No note added'}</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    <span className={`payment-chip ${(paymentStatus || 'UNPAID').toLowerCase()}`}>
                      {paymentLabel(paymentStatus)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Dispute</dt>
                  <dd>{latestDispute ? latestDispute.status.toLowerCase().replace(/_/g, ' ') : 'None'}</dd>
                </div>
              </dl>

              <div className="booking-total-row">
                <span>{priceLabel}</span>
                <strong>{price}</strong>
              </div>
              {guidePrice !== null && payableAmount !== null && payableAmount !== guidePrice && (
                <p className="booking-payment-notice">
                  Guide price on listing: {money(guidePrice)}
                </p>
              )}

              {awaitingPaymentToStart && (
                <p className="booking-payment-notice" role="status">
                  Your booking was accepted. Pay securely below so your artisan can start the service.
                </p>
              )}

              <div className="booking-card-actions">
                {canPay && (
                  <button
                    className="primary-action"
                    disabled={busy}
                    onClick={() => setPaymentPrompt(booking)}
                  >
                    Pay securely
                  </button>
                )}
                {paymentStatus === 'PAID_HELD' && (
                  <button className="secondary-button" disabled>
                    Payment secured
                  </button>
                )}
                {paymentStatus === 'RELEASED' && (
                  <button className="secondary-button" disabled>
                    Payment released
                  </button>
                )}
                {['REQUESTED', 'ACCEPTED'].includes(booking.status) && (
                  <button disabled={busy} onClick={() => runAction(() => cancelBooking(booking.id), 'Booking cancelled')}>
                    Cancel request
                  </button>
                )}
                {(['REQUESTED', 'ACCEPTED'] as Booking['status'][]).includes(booking.status) && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => startReschedule(booking)}
                  >
                    Reschedule
                  </button>
                )}
                {booking.status === 'ACCEPTED' && (
                  <button className="secondary-button" onClick={openMessages}>
                    Open chat
                  </button>
                )}
                {canDispute && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => runAction(() => openDispute(booking.id), 'Dispute opened')}
                  >
                    Raise dispute
                  </button>
                )}
                {canLeaveReview(booking) && (
                  <button type="button" disabled={busy} onClick={() => setReviewBooking(booking)}>
                    Leave review
                  </button>
                )}
                {booking.status === 'COMPLETED' && !booking.review && !paymentSecured && (
                  <span className="review-submitted-label">Review opens after payment is secured</span>
                )}
                {booking.status === 'COMPLETED' && booking.review && (
                  <span className="review-submitted-label">
                    Review submitted · {booking.review.rating}/5
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
    </>
  );
}
