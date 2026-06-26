import { FormEvent } from 'react';
import { LocationTrigger } from '../../components/LocationTrigger';
import { heroImage } from '../../lib/marketingAssets';

export function Hero({
  locationLabel,
  searchTerm,
  onSearchTermChange,
  onSearch,
  onBrowse,
  onOpenLocationPicker,
  onUseMyLocation,
  onBecomeArtisan,
  isDetectingLocation = false,
}: {
  locationLabel: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: (queryText: string) => Promise<void>;
  onBrowse: () => void;
  onOpenLocationPicker: () => void;
  onUseMyLocation: () => void;
  onBecomeArtisan?: () => void;
  isDetectingLocation?: boolean;
}) {
  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSearch(searchTerm);
  }

  return (
    <section className="hero">
      <div className="hero-media">
        <img
          src={heroImage}
          alt="Professional cleaning a bright home"
          width={960}
          height={640}
          fetchPriority="high"
          decoding="async"
        />
      </div>
      <div className="hero-copy">
        <p className="eyebrow">BUNDO MARKETPLACE</p>
        <h1>Quality home services, on demand</h1>
        <p>Experienced professionals for the work that keeps daily life moving.</p>
        <form className="hero-search" onSubmit={submitSearch}>
          <div className="search-heading">
            <label htmlFor="service-location">Where do you need a service?</label>
            <span>Find trusted help near you</span>
          </div>
          <div className="location-control">
            <div className="field-shell field-shell--location">
              <span>Location</span>
              <LocationTrigger
                id="service-location"
                className="hero-location-trigger-wrap"
                locationLabel={locationLabel}
                isDetectingLocation={isDetectingLocation}
                onOpen={onOpenLocationPicker}
                onUseMyLocation={onUseMyLocation}
              />
            </div>
            <div className="field-shell">
              <span>Service</span>
              <input
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
                placeholder="Cleaning, baking, repairs"
                type="search"
              />
            </div>
            <button type="submit">
              Search
            </button>
          </div>
          <button className="browse-link" type="button" onClick={onBrowse}>
            Browse all services
          </button>
          {onBecomeArtisan && (
            <button className="browse-link artisan-hero-link" type="button" onClick={onBecomeArtisan}>
              Offer your services on Bundo
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
