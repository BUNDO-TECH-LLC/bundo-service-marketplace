import { FormEvent, useState } from 'react';
import type { User } from 'firebase/auth';
import { useBookingConfirmedOptional } from '../contexts/BookingConfirmedContext';
import { createBookingRequest, defaultBookingLocation } from '../lib/bookingRequest';
import { categoryIcon } from '../lib/categoryIcon';
import { heroImage } from '../lib/marketingAssets';
import { money } from '../lib/formatting';
import { nigeriaStates } from '../lib/geo';
import { userDisplayName } from '../lib/userDisplayName';
import type { ActionRunner, BookingSuccessState } from '../appTypes';
import type { ApiUser, Artisan, Category, Offering } from '../types';
import { EmptyState } from '../components/EmptyState';
import { AppIcon } from '../components/ui/AppIcon';

export function LoggedInHome({
  me,
  firebaseUser,
  categories,
  offerings,
  artisans,
  selectedState,
  searchTerm,
  token,
  busy,
  onSearchTermChange,
  onSelectedStateChange,
  onBrowse,
  onSearch,
  onViewProfile,
  runAction,
  reloadPrivate,
  onBookingSuccess,
  openBookings,
}: {
  me: ApiUser;
  firebaseUser: User | null;
  categories: Category[];
  offerings: Offering[];
  artisans: Artisan[];
  selectedState: string;
  searchTerm: string;
  token: string;
  busy: boolean;
  onSearchTermChange: (value: string) => void;
  onSelectedStateChange: (value: string) => void;
  onBrowse: (categoryId?: string) => Promise<void>;
  onSearch: () => Promise<void>;
  onViewProfile: (artisanId: string) => Promise<void>;
  runAction: ActionRunner;
  reloadPrivate: () => Promise<void>;
  onBookingSuccess: (booking: BookingSuccessState) => void;
  openBookings: () => void;
}) {
  const displayName = userDisplayName(firebaseUser, me);
  const recommendedOfferings = offerings.slice(0, 3);
  const featuredArtisan = artisans[0];
  const [activeOfferingAction, setActiveOfferingAction] = useState<string | null>(null);
  const bookingConfirmed = useBookingConfirmedOptional();

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSearch();
  }

  async function bookRecommendedOffering(offering: Offering) {
    const actionKey = `book:${offering.id}`;
    setActiveOfferingAction(actionKey);

    try {
      await runAction(async () => {
        const scheduledAt = new Date(Date.now() + 86400000).toISOString();
        const artisan = offering.artisan;

        const response = await createBookingRequest({
          token,
          offeringId: offering.id,
          scheduledAt,
          note: 'Booked from dashboard',
        });
        await reloadPrivate();

        const successState = {
          bookingId: response.booking.id,
          artisanId: artisan?.id || offering.artisanId,
          serviceTitle: offering.title,
          artisanName: artisan?.displayName || 'this artisan',
          scheduledAt: response.booking.scheduledAt || scheduledAt,
          location: defaultBookingLocation(artisan?.area, artisan?.city),
        };

        if (bookingConfirmed && artisan?.id) {
          bookingConfirmed.showBookingConfirmed({
            ...successState,
            token,
          });
        }

        onBookingSuccess(successState);
      });
    } finally {
      setActiveOfferingAction(null);
    }
  }

  return (
    <main className="logged-home">
      <section className="logged-hero">
        <div className="logged-hero-copy">
          <p className="eyebrow">Welcome back, {displayName}</p>
          <h1>
            Connect with artisans who <span>deliver.</span>
          </h1>
          <form className="logged-hero-search" onSubmit={submitSearch}>
            <label>
              Search
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
                placeholder="Cleaning, tailoring, repairs"
              />
            </label>
            <label>
              Location
              <select value={selectedState} onChange={(event) => onSelectedStateChange(event.target.value)}>
                <option value="">All Nigeria</option>
                {nigeriaStates.map((state) => (
                  <option key={state} value={state}>
                    {state}, Nigeria
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Search</button>
          </form>
          <div className="quick-service-grid" aria-label="Quick service picks">
            {categories.slice(0, 6).map((category) => (
              <button key={category.id} type="button" onClick={() => void onBrowse(category.id)}>
                <span><AppIcon icon={categoryIcon(category.iconKey)} /></span>
                {category.name}
              </button>
            ))}
            <button className="wide" type="button" onClick={() => void onBrowse()}>
              Browse marketplace
            </button>
            <button className="wide" type="button" onClick={openBookings}>
              My bookings
            </button>
          </div>
        </div>

        <div className="logged-hero-media">
          <img src={heroImage} alt="Bundo artisan completing a home service" />
          <div>
            <strong>{featuredArtisan?.displayName || 'Trusted professionals'}</strong>
            <span>
              {featuredArtisan
                ? `${featuredArtisan.city}${featuredArtisan.area ? `, ${featuredArtisan.area}` : ''}`
                : 'Available across your marketplace'}
            </span>
          </div>
        </div>
      </section>

      <section className="logged-section">
        <div className="logged-section-head">
          <h2>Categories</h2>
          <button type="button" onClick={() => void onBrowse()}>View all categories</button>
        </div>
        <div className="logged-category-row">
          {categories.length === 0 && <span className="muted">Categories will appear here after seeding.</span>}
          {categories.slice(0, 7).map((category) => (
            <button key={category.id} type="button" onClick={() => void onBrowse(category.id)}>
              <span><AppIcon icon={categoryIcon(category.iconKey)} /></span>
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <section className="logged-section">
        <div className="logged-section-head">
          <h2>Recommended</h2>
          <button type="button" onClick={() => void onBrowse()}>Browse artisans</button>
        </div>
        <div className="recommended-row">
          {recommendedOfferings.length === 0 && (
            <EmptyState
              title="No recommendations yet"
              body="Approved artisan offerings will appear here as your marketplace grows."
            />
          )}
          {recommendedOfferings.map((offering) => {
            const actionKey = `book:${offering.id}`;
            const isBookingThisOffering = activeOfferingAction === actionKey;

            return (
              <article className="recommended-card" key={offering.id}>
                <div className="recommended-card-head">
                  <span className="recommended-avatar">
                    {(offering.artisan?.displayName || 'B').slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h3>{offering.artisan?.displayName || 'Approved artisan'}</h3>
                    <p>{offering.artisan?.area || offering.artisan?.city || 'Nearby'}</p>
                  </div>
                  <small>{offering.artisan?.city || 'Bundo'}</small>
                </div>
                <div className="recommended-tags">
                  <span>{offering.category?.name || 'Service'}</span>
                  <span>{offering.title}</span>
                </div>
                <div className="recommended-meta">
                  <span className="rating">★★★★★</span>
                  <span>{(offering.artisan?.avgRating || 0).toFixed(1)}({offering.artisan?.ratingCount || 0})</span>
                  <strong>From {money(offering.priceFrom)}</strong>
                </div>
                <button
                  className="primary-button"
                  disabled={me.role !== 'CUSTOMER' || isBookingThisOffering}
                  onClick={() => void bookRecommendedOffering(offering)}
                >
                  {isBookingThisOffering ? 'Booking...' : 'Book'}
                </button>
                {offering.artisan?.id && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => void onViewProfile(offering.artisan!.id)}
                  >
                    View profile
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}