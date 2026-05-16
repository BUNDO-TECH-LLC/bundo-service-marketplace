import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { useBookingConfirmed } from '../../contexts/BookingConfirmedContext';
import { AppIcon } from '../../components/ui/AppIcon';
import { ProfileAvatar } from '../../components/ui/ProfileAvatar';
import { browseLocationAreaOptions } from '../../constants/data';
import { api } from '../../lib/api';
import { resolveApiSession } from '../../lib/authSession';
import {
  buildScheduledAt,
  createBookingRequest,
  estimateServiceFee,
  timeSlotOptions,
} from '../../lib/bookingRequest';
import { formatDistanceFromBrowseArea } from '../../lib/geo';
import { money } from '../../lib/formatting';
import { auth } from '../../lib/firebase';
import { artisanProfileImageUrl } from '../../lib/profileImage';
import type { ApiUser, Artisan, Offering } from '../../types';
import {
  appRoutes,
  buildCategoriesPath,
  buildCustomerWorkspacePath,
} from '../../routes/paths';

function StarRow({ rating }: { rating: number }) {
  const filled = Math.min(5, Math.max(0, Math.round(rating)));

  return (
    <span className="book-job-stars" aria-label={`Rating ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <AppIcon
          key={index}
          icon={index < filled ? 'mdi:star' : 'mdi:star-outline'}
          size={16}
          className={index < filled ? 'book-job-stars__fill' : 'book-job-stars__empty'}
        />
      ))}
    </span>
  );
}

function defaultLocationLabel(browseArea: string) {
  if (!browseArea) {
    return 'Lagos, Nigeria';
  }

  const option = browseLocationAreaOptions.find((opt) => opt.value === browseArea);
  if (option && option.label !== 'All areas') {
    return option.label.includes('Nigeria') ? option.label : `${option.label}, Nigeria`;
  }

  return 'Lagos, Nigeria';
}

export default function BookJobPage() {
  const navigate = useNavigate();
  const { showBookingConfirmed } = useBookingConfirmed();
  const [searchParams] = useSearchParams();
  const artisanId = searchParams.get('artisanId') || '';
  const offeringIdParam = searchParams.get('offeringId') || '';

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [me, setMe] = useState<ApiUser | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [headerSearch, setHeaderSearch] = useState('');
  const [headerState, setHeaderState] = useState('');

  const [offeringId, setOfferingId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState<string>(timeSlotOptions[0].value);
  const [location, setLocation] = useState('Lagos, Nigeria');
  const [notes, setNotes] = useState('');
  const [locationEditing, setLocationEditing] = useState(false);

  useEffect(() => {
    if (!artisanId) {
      navigate(appRoutes.categories, { replace: true });
    }
  }, [artisanId, navigate]);

  useEffect(() => {
    if (!auth) {
      navigate(appRoutes.login, { replace: true });
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        navigate(appRoutes.login, { replace: true });
        return;
      }

      try {
        const session = await resolveApiSession(user);

        if (session.user.role === 'ARTISAN') {
          navigate(appRoutes.artisanDashboard, { replace: true });
          return;
        }

        if (session.user.role === 'ADMIN') {
          navigate(appRoutes.admin, { replace: true });
          return;
        }

        setToken(session.token);
        setMe(session.user);
      } catch {
        navigate(appRoutes.login, { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!artisanId) {
      return;
    }

    setBusy(true);
    setNotice('');

    api<{ artisan: Artisan }>(`/artisans/${artisanId}`)
      .then((response) => {
        setArtisan(response.artisan);
      })
      .catch(() => {
        setNotice('Could not load this artisan right now.');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [artisanId]);

  useEffect(() => {
    if (!artisan?.offerings?.length) {
      return;
    }

    const offerings = artisan.offerings;
    const preferred =
      offerings.find((offering) => offering.id === offeringIdParam) || offerings[0];

    setOfferingId(preferred.id);
  }, [artisan, offeringIdParam]);

  useEffect(() => {
    setLocation(defaultLocationLabel(headerState));
  }, [headerState]);

  const offerings = artisan?.offerings || [];
  const selectedOffering: Offering | undefined =
    offerings.find((offering) => offering.id === offeringId) || offerings[0];

  const primaryCategoryName = selectedOffering?.category?.name || offerings[0]?.category?.name || 'Service';
  const distanceLabel =
    artisan && formatDistanceFromBrowseArea(artisan.lat, artisan.lng, headerState || artisan.area || '');

  const servicePrice = selectedOffering?.priceFrom ?? 0;
  const serviceFee = estimateServiceFee(servicePrice);
  const estimatedTotal = servicePrice + serviceFee;

  const canBook = Boolean(selectedOffering && offerings.length > 0);

  const helperExamples = useMemo(() => {
    const titles = offerings.slice(0, 3).map((offering) => offering.title);
    return titles.length > 0 ? titles.join(', ') : 'Basic inspection, Full pipe repair, Installation';
  }, [offerings]);

  async function logout() {
    if (auth) {
      await signOut(auth);
    }

    navigate(appRoutes.home, { replace: true });
  }

  function submitHeaderSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(
      buildCategoriesPath({
        q: headerSearch.trim() || undefined,
        state: headerState || undefined,
      })
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedOffering || !date || !artisan) {
      return;
    }

    setBusy(true);
    setNotice('');

    const scheduledAt = buildScheduledAt(date, timeSlot);
    const locationValue = location.trim() || 'Not specified';
    const noteParts = [`Service location: ${locationValue}`];
    if (notes.trim()) {
      noteParts.push(notes.trim());
    }

    try {
      const response = await createBookingRequest({
        token,
        offeringId: selectedOffering.id,
        scheduledAt,
        note: noteParts.join('\n\n'),
      });

      showBookingConfirmed({
        bookingId: response.booking.id,
        artisanId: artisan.id,
        artisanName: artisan.displayName,
        serviceTitle: selectedOffering.title,
        scheduledAt: response.booking.scheduledAt || scheduledAt,
        location: locationValue,
        token,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not send your booking request.');
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(buildCategoriesPath({}));
  }

  return (
    <div className="book-job-page min-h-full bg-[var(--color-paper)] py-6">
      <CustomerHeader
        firebaseUser={firebaseUser}
        me={me}
        activeNav="bookings"
        searchContent={
          <form className="book-job-header-search" onSubmit={submitHeaderSearch}>
            <label className="book-job-header-search__field">
              <AppIcon icon="mingcute:search-line" className="book-job-header-search__icon" size={24} />
              <input
                className="book-job-header-search__input"
                value={headerSearch}
                onChange={(event) => setHeaderSearch(event.target.value)}
                placeholder="Search for artisan"
                type="search"
                aria-label="Search for artisan"
              />
            </label>
            <div className="book-job-header-search__field">
              <select
                className="book-job-header-search__select"
                value={headerState}
                onChange={(event) => setHeaderState(event.target.value)}
                aria-label="Location"
              >
                {browseLocationAreaOptions.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label === 'All areas' ? 'Lagos, Nigeria' : opt.label}
                  </option>
                ))}
              </select>
              <AppIcon icon="mdi:chevron-down" size={18} />
            </div>
          </form>
        }
        onOpenDashboard={() => navigate(appRoutes.customerDashboard)}
        onOpenMarketplace={() => navigate(buildCategoriesPath({}))}
        onOpenNotifications={() => navigate(buildCustomerWorkspacePath('notifications'))}
        onOpenWorkspace={(section) => navigate(buildCustomerWorkspacePath(section))}
        onUserUpdated={setMe}
        onLogout={logout}
      />

      <main className="app-screen-gutter book-job-main">
        <h1 className="book-job-title">Book a Job</h1>

        {notice ? <div className="notice book-job-notice">{notice}</div> : null}

        {!artisan && !notice ? (
          <p className="book-job-loading">Loading booking details…</p>
        ) : null}

        {artisan ? (
          <div className="book-job-layout">
            <section className="book-job-card book-job-card--details">
              <div className="book-job-artisan">
                <ProfileAvatar
                  name={artisan.displayName}
                  imageUrl={artisanProfileImageUrl(artisan)}
                  className="book-job-artisan__avatar"
                  textClassName="text-xl"
                />
                <div className="book-job-artisan__body">
                  <div className="book-job-artisan__head">
                    <h2 className="book-job-artisan__name">{artisan.displayName}</h2>
                    <button
                      type="button"
                      className="book-job-link"
                      onClick={() => navigate(buildCategoriesPath({}))}
                    >
                      Change
                    </button>
                  </div>
                  <div className="book-job-artisan__meta">
                    <span className="book-job-tag">{primaryCategoryName}</span>
                    <span className="book-job-artisan__rating">
                      <StarRow rating={artisan.avgRating ?? 0} />
                      <span>
                        {(artisan.avgRating ?? 0).toFixed(1)}({artisan.ratingCount ?? 0})
                      </span>
                    </span>
                    {distanceLabel ? <span className="book-job-artisan__distance">{distanceLabel}</span> : null}
                  </div>
                </div>
              </div>

              <p className="book-job-divider">
                <span>Booking details</span>
              </p>

              {canBook ? (
                <form className="book-job-form" onSubmit={handleSubmit}>
                  <label className="book-job-field">
                    <span className="book-job-field__label">Service type</span>
                    <select
                      className="book-job-field__control"
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
                    <small className="book-job-field__hint">e.g {helperExamples}</small>
                  </label>

                  <div className="book-job-field-row">
                    <label className="book-job-field">
                      <span className="book-job-field__label">Preferred date</span>
                      <input
                        className="book-job-field__control book-job-field__control--date"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        required
                      />
                    </label>
                    <label className="book-job-field">
                      <span className="book-job-field__label">Preferred time</span>
                      <select
                        className="book-job-field__control"
                        value={timeSlot}
                        onChange={(event) => setTimeSlot(event.target.value)}
                      >
                        {timeSlotOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="book-job-field">
                    <span className="book-job-field__label book-job-field__label--row">
                      Confirm location
                      {!locationEditing ? (
                        <button
                          type="button"
                          className="book-job-link"
                          onClick={() => setLocationEditing(true)}
                        >
                          Edit
                        </button>
                      ) : null}
                    </span>
                    <input
                      className="book-job-field__control"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      readOnly={!locationEditing}
                      required
                    />
                    <small className="book-job-field__hint">Artisan will come to this address.</small>
                  </label>

                  <label className="book-job-field">
                    <span className="book-job-field__label">Notes (optional)</span>
                    <textarea
                      className="book-job-field__control book-job-field__control--textarea"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Describe the issue or any specific instructions"
                      rows={4}
                    />
                  </label>

                  <div className="book-job-actions">
                    <button
                      type="submit"
                      className="book-job-btn book-job-btn--primary"
                      disabled={busy || !token || !date}
                    >
                      Send booking request
                    </button>
                    <button
                      type="button"
                      className="book-job-btn book-job-btn--cancel"
                      disabled={busy}
                      onClick={handleCancel}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <p className="book-job-empty">This artisan has not listed bookable services yet.</p>
              )}
            </section>

            <aside className="book-job-card book-job-card--summary">
              <h2 className="book-job-summary__title">Price Summary</h2>

              {selectedOffering ? (
                <>
                  <dl className="book-job-summary__lines">
                    <div className="book-job-summary__line">
                      <dt>{selectedOffering.title}</dt>
                      <dd>{money(servicePrice)}</dd>
                    </div>
                    <div className="book-job-summary__line">
                      <dt>Service fee</dt>
                      <dd>{money(serviceFee)}</dd>
                    </div>
                  </dl>

                  <div className="book-job-summary__total">
                    <span>Estimated total</span>
                    <strong>{money(estimatedTotal)}</strong>
                  </div>
                </>
              ) : (
                <p className="book-job-empty">Select a service to see pricing.</p>
              )}

              <dl className="book-job-summary__meta">
                <div className="book-job-summary__meta-row">
                  <dt>Response Time</dt>
                  <dd>Under 1 hour</dd>
                </div>
                <div className="book-job-summary__meta-row">
                  <dt>Cancellation policy</dt>
                  <dd>Free before 24 hrs</dd>
                </div>
              </dl>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
