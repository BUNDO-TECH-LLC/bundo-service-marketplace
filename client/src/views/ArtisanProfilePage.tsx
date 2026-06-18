import { FormEvent, useEffect, useState } from 'react';
import { useAppRoot } from '../app/appRootContext';
import { api } from '../lib/api';
import { completeBookingRequest } from '../lib/bookingSuccess';
import { money } from '../lib/formatting';
import {
  buildTimeOptionsForDate,
  formatAvailabilityHint,
  todayDateInputValue,
  validateBookingDateTime,
} from '../lib/bookingSchedule';
import type { ActionRunner, BookingSuccessState } from '../appTypes';
import type { Artisan, AvailabilitySlot, Booking, Review, Role } from '../types';
import { EmptyState } from '../components/EmptyState';
import { ProfilePortfolioGallery } from '../components/ProfilePortfolioGallery';

export function ArtisanProfilePage({
  artisan,
  reviews,
  isAuthed,
  role,
  token,
  busy,
  runAction,
  onBack,
  reloadPrivate,
  onBookingSuccess,
}: {
  artisan: Artisan;
  reviews: Review[];
  isAuthed: boolean;
  role: Role | null;
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  onBack: () => void;
  reloadPrivate: () => Promise<void>;
  onBookingSuccess: (booking: BookingSuccessState) => void;
}) {
  const { promptCustomerLogin } = useAppRoot();
  const offerings = artisan.offerings || [];
  const canBookAsCustomer = isAuthed && role === 'CUSTOMER';
  const firstOffering = offerings[0];
  const [offeringId, setOfferingId] = useState(firstOffering?.id || '');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [note, setNote] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>(artisan.availabilitySlots || []);
  const selectedOffering = offerings.find((offering) => offering.id === offeringId) || firstOffering;
  const timeOptions = buildTimeOptionsForDate(date, slots);
  const initials = artisan.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const joined = artisan.createdAt
    ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(artisan.createdAt))
    : 'Recently';

  useEffect(() => {
    void api<{ slots: AvailabilitySlot[] }>(`/artisans/${artisan.id}/availability-slots`)
      .then((response) => setSlots(response.slots))
      .catch(() => setSlots(artisan.availabilitySlots || []));
  }, [artisan.id, artisan.availabilitySlots]);

  useEffect(() => {
    if (timeSlot && !timeOptions.includes(timeSlot)) {
      setTimeSlot(timeOptions[0] || '');
    }
  }, [date, timeOptions, timeSlot]);

  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthed) {
      promptCustomerLogin();
      return;
    }
    if (!canBookAsCustomer || !selectedOffering || !date || !timeSlot) return;

    const validationError = validateBookingDateTime(date, timeSlot, slots);
    if (validationError) {
      setBookingError(validationError);
      return;
    }

    setBookingError('');

    const response = await api<{ booking: Booking }>('/bookings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        offeringId: selectedOffering.id,
        scheduledAt: new Date(`${date}T${timeSlot}:00`).toISOString(),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    });
    await completeBookingRequest({
      booking: response.booking,
      serviceTitle: selectedOffering.title,
      artisanName: artisan.displayName,
      onBookingSuccess,
      reloadPrivate,
    });
  }

  return (
    <main className="artisan-profile-page">
      <button className="back-button profile-back" onClick={onBack}>Back to marketplace</button>

      <section className="profile-hero-card">
        <div className="profile-avatar">{initials || 'BP'}</div>
        <div className="profile-summary">
          <p className="eyebrow">Verified professional</p>
          <h1>{artisan.displayName}</h1>
          <p>{offerings[0]?.category?.name || 'Bundo artisan'}</p>
          <div className="profile-meta">
            <span>{artisan.area || 'Available area'}, {artisan.city}</span>
            <span>{artisan.avgRating || 0} rating ({artisan.ratingCount} reviews)</span>
          </div>
        </div>
        <button
          disabled={busy || (canBookAsCustomer && !selectedOffering)}
          onClick={() => {
            if (!isAuthed) {
              promptCustomerLogin();
              return;
            }
            document.getElementById('profile-booking-card')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Book now
        </button>
      </section>

      <nav className="profile-tabs" aria-label="Artisan profile sections">
        <a href="#about">About</a>
        <a href="#portfolio">Portfolio</a>
        <a href="#pricing">Pricing</a>
        <a href="#reviews">Reviews</a>
      </nav>

      <section className="profile-layout">
        <div className="profile-main">
          <section id="about" className="profile-section">
            <h2>About</h2>
            <p>
              {artisan.bio ||
                `${artisan.displayName} is an approved Bundo professional serving customers around ${artisan.area || artisan.city}. Review their services and request a booking when you are ready.`}
            </p>
          </section>

          <section id="portfolio" className="profile-section">
            <div className="profile-section-head">
              <h2>Portfolio</h2>
              {(artisan.portfolioImages?.length ?? 0) > 0 && (
                <span className="profile-portfolio-count">{artisan.portfolioImages?.length} photos</span>
              )}
            </div>
            <ProfilePortfolioGallery
              images={artisan.portfolioImages ?? []}
              artisanName={artisan.displayName}
            />
          </section>

          <section id="pricing" className="profile-section">
            <h2>Pricing</h2>
            <div className="pricing-list">
              {offerings.length === 0 && <EmptyState title="No offerings yet" body="This artisan has not listed public services." />}
              {offerings.map((offering) => (
                <article className="pricing-row" key={offering.id}>
                  <div>
                    <strong>{offering.title}</strong>
                    <p>{offering.description || offering.category?.name || 'Professional service'}</p>
                  </div>
                  <span>
                    {money(offering.priceFrom)}
                    {offering.priceTo ? ` - ${money(offering.priceTo)}` : ''}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section id="reviews" className="profile-section">
            <h2>Reviews</h2>
            <div className="review-list">
              {reviews.length === 0 && <EmptyState title="No reviews yet" body="Completed customer reviews will appear here." />}
              {reviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <div className="review-head">
                    <span className="review-avatar">C</span>
                    <div>
                      <strong>Bundo customer</strong>
                      <small>{new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(review.createdAt))}</small>
                    </div>
                  </div>
                  <p className="rating-dots">{Array.from({ length: 5 }).map((_, index) => <span key={index} className={index < review.rating ? 'active' : ''} />)}</p>
                  <p>{review.comment || 'Reliable service from this Bundo professional.'}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="booking-card" id="profile-booking-card">
          <h2>Book {artisan.displayName.split(' ')[0]}</h2>
          <form onSubmit={(event) => runAction(() => createBooking(event), '')}>
            <label>
              Select service
              <select value={offeringId} onChange={(event) => setOfferingId(event.target.value)} required>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>{offering.title}</option>
                ))}
              </select>
            </label>
            <p className="muted">{formatAvailabilityHint(slots)}</p>
            <label>
              Date
              <input
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setBookingError('');
                }}
                type="date"
                min={todayDateInputValue()}
                required
              />
            </label>
            <label>
              Time slot
              <select
                value={timeSlot}
                onChange={(event) => {
                  setTimeSlot(event.target.value);
                  setBookingError('');
                }}
                required
                disabled={!date || timeOptions.length === 0}
              >
                <option value="">
                  {!date ? 'Select a date first' : timeOptions.length ? 'Select a time' : 'No slots this day'}
                </option>
                {timeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note for artisan (optional)
              <textarea
                value={note}
                maxLength={500}
                rows={3}
                placeholder="Share job details or access instructions."
                onChange={(event) => setNote(event.target.value)}
              />
            </label>

            {bookingError && <p className="auth-field-error">{bookingError}</p>}

            <div className="booking-total">
              <span>Guide price</span>
              <strong>{selectedOffering ? money(selectedOffering.priceFrom) : 'Select service'}</strong>
            </div>
            <p className="booking-payment-notice">
              Final price is agreed with your artisan before you pay from My bookings.
            </p>
            <p className="booking-payment-notice">
              After you book, chat with {artisan.displayName.split(' ')[0]} from My bookings.
            </p>

            <button disabled={busy || !selectedOffering || !date || !timeSlot || (isAuthed && role !== 'CUSTOMER')}>
              {busy ? 'Booking...' : 'Request booking'}
            </button>
          </form>
          <p className="muted">Member since {joined}</p>
        </aside>
      </section>
    </main>
  );
}
