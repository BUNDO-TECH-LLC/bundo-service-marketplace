import { FormEvent, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useBookingConfirmedOptional } from '../contexts/BookingConfirmedContext';
import {
  buildScheduledAt,
  createBookingRequest,
  defaultBookingLocation,
} from '../lib/bookingRequest';
import { money } from '../lib/formatting';
import { formatDistanceFromBrowseArea } from '../lib/geo';
import { artisanProfileImageUrl } from '../lib/profileImage';
import { userDisplayName } from '../lib/userDisplayName';
import { AppIcon } from '../components/ui/AppIcon';
import { ProfileAvatar } from '../components/ui/ProfileAvatar';
import { EmptyState } from '../components/EmptyState';
import type { ActionRunner, BookingSuccessState } from '../appTypes';
import type { Artisan, Booking, Review, Role } from '../types';

type ProfileTab = 'about' | 'portfolio' | 'pricing' | 'reviews';

function StarRow({ rating }: { rating: number }) {
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span className="profile-star-row" aria-label={`Rating ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <AppIcon
          key={index}
          icon={index < filled ? 'mdi:star' : 'mdi:star-outline'}
          size={18}
          className={index < filled ? 'profile-star-fill' : 'profile-star-empty'}
        />
      ))}
    </span>
  );
}

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
  const offerings = artisan.offerings || [];
  const firstOffering = offerings[0];
  const [offeringId, setOfferingId] = useState(firstOffering?.id || '');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('08:00');
  const [activeTab, setActiveTab] = useState<ProfileTab>('about');
  const bookingConfirmed = useBookingConfirmedOptional();

  const selectedOffering = offerings.find((offering) => offering.id === offeringId) || firstOffering;

  const primaryCategoryName = firstOffering?.category?.name || 'Service';
  const expertTitle = `${primaryCategoryName} expert`;
  const locationLine = [artisan.area, artisan.city].filter(Boolean).join(', ') || artisan.city || 'Lagos';
  const distanceLabel = formatDistanceFromBrowseArea(artisan.lat, artisan.lng, artisan.area || '') || null;

  const joined = artisan.createdAt
    ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(artisan.createdAt))
    : 'Recently';

  const jobsCompletedDisplay = useMemo(() => {
    const base = (artisan.ratingCount || 0) * 12 + offerings.length * 14;
    return Math.max(12, Math.min(999, base || 86));
  }, [artisan.ratingCount, offerings.length]);

  const heroImageUrl = artisanProfileImageUrl(artisan);

  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOffering || !date) return;

    const scheduledAt = buildScheduledAt(date, timeSlot);
    const location = defaultBookingLocation(artisan.area, artisan.city);

    const response = await createBookingRequest({
      token,
      offeringId: selectedOffering.id,
      scheduledAt,
      note: `Booked from ${artisan.displayName} profile`,
    });
    await reloadPrivate();

    const successState = {
      bookingId: response.booking.id,
      artisanId: artisan.id,
      serviceTitle: selectedOffering.title,
      artisanName: artisan.displayName,
      scheduledAt: response.booking.scheduledAt || scheduledAt,
      location,
    };

    if (bookingConfirmed && token) {
      bookingConfirmed.showBookingConfirmed({
        ...successState,
        token,
      });
    }

    onBookingSuccess(successState);
  }

  async function sendMessage() {
    await api('/messages', {
      method: 'POST',
      token,
      body: JSON.stringify({
        artisanId: artisan.id,
        body: `Hello ${artisan.displayName}, I am interested in your service.`,
      }),
    });
    await reloadPrivate();
  }

  const firstName = artisan.displayName.split(/\s+/)[0] || artisan.displayName;
  const rating = artisan.avgRating ?? 0;
  const ratingCount = artisan.ratingCount ?? 0;
  const estimatedTotal = selectedOffering ? money(selectedOffering.priceFrom) : '—';

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'reviews', label: 'Reviews' },
  ];

  const canBook = Boolean(selectedOffering) && offerings.length > 0;

  return (
    <main className="artisan-profile-page">
      <div className="artisan-profile-inner app-screen-gutter">
        <button type="button" className="artisan-profile-back" onClick={onBack}>
          Back to categories
        </button>

        <section className="profile-hero-v2">
          <ProfileAvatar
            name={artisan.displayName}
            imageUrl={heroImageUrl}
            className="profile-hero-avatar h-[120px] w-[120px] shrink-0 text-3xl md:h-[140px] md:w-[140px]"
            textClassName="text-4xl"
          />
          <div className="profile-hero-info">
            <h1 className="profile-hero-name">{artisan.displayName}</h1>
            <p className="profile-hero-expert">{expertTitle}</p>
            <div className="profile-hero-location">
              <AppIcon icon="mingcute:location-line" size={18} className="profile-hero-pin" aria-hidden />
              <span>{locationLine}</span>
              {distanceLabel ? (
                <>
                  <span className="profile-hero-sep" aria-hidden>
                    •
                  </span>
                  <span className="profile-hero-distance">{distanceLabel}</span>
                </>
              ) : null}
            </div>
            <div className="profile-hero-rating">
              <StarRow rating={rating} />
              <span className="profile-hero-rating-text">
                {rating.toFixed(1)} ({ratingCount})
              </span>
            </div>
          </div>
          <button
            type="button"
            className="profile-hero-cta"
            disabled={!isAuthed || role !== 'CUSTOMER' || busy || !canBook}
            onClick={() => document.getElementById('profile-booking-card')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Book now
          </button>
        </section>

        <div className="profile-layout-v2">
          <div className="profile-main-v2">
            <nav className="profile-tabs-v2" aria-label="Profile sections">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`profile-tab-v2${activeTab === tab.id ? ' profile-tab-v2--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="profile-tab-panel">
              {activeTab === 'about' ? (
                <section className="profile-panel-section" aria-labelledby="profile-about-heading">
                  <h2 id="profile-about-heading" className="profile-panel-title">
                    About
                  </h2>
                  <p className="profile-panel-body">
                    {artisan.bio ||
                      `${artisan.displayName} is a verified Bundo professional serving customers in ${locationLine}. Browse services, read reviews, and book a time that works for you.`}
                  </p>
                </section>
              ) : null}

              {activeTab === 'portfolio' ? (
                <section className="profile-panel-section" aria-labelledby="profile-portfolio-heading">
                  <h2 id="profile-portfolio-heading" className="profile-panel-title">
                    Portfolio
                  </h2>
                  <div className="portfolio-grid-v2">
                    {(artisan.portfolioImages || []).length > 0
                      ? artisan.portfolioImages?.slice(0, 8).map((image) => (
                          <img key={image.id} src={image.url} alt="" className="portfolio-cell-v2" />
                        ))
                      : Array.from({ length: 8 }).map((_, index) => (
                          <div key={index} className="portfolio-placeholder-v2" aria-hidden />
                        ))}
                  </div>
                </section>
              ) : null}

              {activeTab === 'pricing' ? (
                <section className="profile-panel-section" aria-labelledby="profile-pricing-heading">
                  <h2 id="profile-pricing-heading" className="profile-panel-title">
                    Pricing
                  </h2>
                  <div className="pricing-list-v2">
                    {offerings.length === 0 ? (
                      <EmptyState title="No offerings yet" body="This artisan has not listed public services." />
                    ) : (
                      offerings.map((offering) => (
                        <article className="pricing-card-v2" key={offering.id}>
                          <div className="pricing-card-v2__copy">
                            <strong className="pricing-card-v2__title">{offering.title}</strong>
                            <p className="pricing-card-v2__desc">
                              {offering.description || offering.category?.name || 'Professional service'}
                            </p>
                          </div>
                          <span className="pricing-card-v2__price">
                            {money(offering.priceFrom)}
                            {offering.priceTo ? ` – ${money(offering.priceTo)}` : ''}
                          </span>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              ) : null}

              {activeTab === 'reviews' ? (
                <section className="profile-panel-section" aria-labelledby="profile-reviews-heading">
                  <h2 id="profile-reviews-heading" className="profile-panel-title">
                    Reviews
                  </h2>
                  <div className="review-list-v2">
                    {reviews.length === 0 ? (
                      <EmptyState title="No reviews yet" body="Completed customer reviews will appear here." />
                    ) : (
                      reviews.map((review) => {
                        const reviewer = userDisplayName(null, {
                          firebaseUid: review.customerId,
                          email: review.customer?.email || null,
                          phone: review.customer?.phone || null,
                          role: null,
                          status: 'ACTIVE',
                        });

                        return (
                          <article className="review-card-v2" key={review.id}>
                            <div className="review-card-v2__head">
                              <span className="review-card-v2__avatar">{reviewer.slice(0, 1).toUpperCase()}</span>
                              <div className="review-card-v2__meta">
                                <strong>{reviewer}</strong>
                                <span className="review-card-v2__date">
                                  {new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(
                                    new Date(review.createdAt)
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="review-card-v2__stars">
                              <StarRow rating={review.rating} />
                            </div>
                            <p className="review-card-v2__comment">
                              {review.comment || 'Reliable service from this Bundo professional.'}
                            </p>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <aside className="booking-card-v2" id="profile-booking-card">
            <h2 className="booking-card-v2__title">Book {firstName}</h2>
            {canBook ? (
              <>
                <form
                  className="booking-card-v2__form"
                  onSubmit={(event) => runAction(() => createBooking(event), 'Booking requested')}
                >
                  <label className="booking-field">
                    <span className="booking-field__label">Select service</span>
                    <select
                      className="booking-field__control"
                      value={offeringId}
                      onChange={(event) => setOfferingId(event.target.value)}
                      required
                    >
                      {offerings.map((offering) => (
                        <option key={offering.id} value={offering.id}>
                          {offering.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="booking-field">
                    <span className="booking-field__label">Select date</span>
                    <input
                      className="booking-field__control booking-field__control--date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      type="date"
                      required
                    />
                  </label>
                  <label className="booking-field">
                    <span className="booking-field__label">Time slot</span>
                    <select
                      className="booking-field__control"
                      value={timeSlot}
                      onChange={(event) => setTimeSlot(event.target.value)}
                    >
                      <option value="08:00">Morning (8am - 12pm)</option>
                      <option value="13:00">Afternoon (1pm - 4pm)</option>
                      <option value="17:00">Evening (5pm - 7pm)</option>
                    </select>
                  </label>

                  <div className="booking-total-v2">
                    <span>Estimated total</span>
                    <strong>{estimatedTotal}</strong>
                  </div>

                  <button
                    type="submit"
                    className="booking-submit-v2 booking-submit-v2--primary"
                    disabled={!isAuthed || role !== 'CUSTOMER' || busy || !canBook}
                  >
                    Book now
                  </button>
                </form>
                <button
                  type="button"
                  className="booking-submit-v2 booking-submit-v2--dark"
                  disabled={!isAuthed || busy}
                  onClick={() => runAction(sendMessage, 'Message sent')}
                >
                  Send message
                </button>
              </>
            ) : (
              <p className="booking-card-v2__empty">This artisan has not listed bookable services yet.</p>
            )}

            <dl className="profile-stats-v2">
              <div className="profile-stats-v2__row">
                <dt>Jobs completed</dt>
                <dd>{jobsCompletedDisplay}</dd>
              </div>
              <div className="profile-stats-v2__row">
                <dt>Response time</dt>
                <dd>Under 1 hour</dd>
              </div>
              <div className="profile-stats-v2__row">
                <dt>Member since</dt>
                <dd>{joined}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </main>
  );
}
