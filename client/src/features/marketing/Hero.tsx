import { FormEvent } from 'react';
import type { LocationSource } from '../../appTypes';
import { heroImage } from '../../lib/marketingAssets';

export function Hero({
  selectedState,
  states,
  onStateChange,
  searchTerm,
  onSearchTermChange,
  onSearch,
  onBrowse,
  onUseMyLocation,
  isDetectingLocation = false,
  locationSource = 'none',
}: {
  selectedState: string;
  states: string[];
  onStateChange: (state: string) => Promise<void>;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: (state: string, queryText: string) => Promise<void>;
  onBrowse: () => void;
  onUseMyLocation: () => void;
  isDetectingLocation?: boolean;
  locationSource?: LocationSource;
}) {
  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSearch(selectedState, searchTerm);
  }

  const locationActive = isDetectingLocation || locationSource === 'auto';

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
            <label htmlFor="service-state">Where do you need a service?</label>
            <span>Find trusted help near you</span>
          </div>
          <div className="location-control">
            <div className="field-shell field-shell--location">
              <span>Location</span>
              <div className="hero-location-row">
                <button
                  type="button"
                  className={`hero-location-trigger${locationActive ? ' hero-location-trigger--active' : ''}`}
                  disabled={isDetectingLocation}
                  aria-label="Use my current location"
                  title="Use my current location"
                  onClick={onUseMyLocation}
                >
                  <span aria-hidden="true">⌖</span>
                </button>
                <select
                  id="service-state"
                  value={selectedState}
                  disabled={isDetectingLocation}
                  aria-label="State"
                  onChange={(event) => onStateChange(event.target.value)}
                >
                  <option value="">{isDetectingLocation ? 'Detecting…' : 'Select your state'}</option>
                  {states.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
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
        </form>
      </div>
    </section>
  );
}
