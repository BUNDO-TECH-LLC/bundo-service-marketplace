import type { MarketplaceSort } from '../../appTypes';
import { LocationTrigger } from '../../components/LocationTrigger';
import { sortCategoriesByCatalog } from '../../lib/serviceCategoryCatalog';
import type { Category } from '../../types';

export function MarketplaceFilters({
  categories,
  locationLabel,
  searchTerm,
  selectedCategoryId,
  sort,
  priceMin,
  priceMax,
  onPriceMinChange,
  onPriceMaxChange,
  onOpenLocationPicker,
  onSearchTermChange,
  onCategoryChange,
  onSortChange,
  onUseMyLocation,
  onApply,
  onClear,
  isDetectingLocation = false,
}: {
  categories: Category[];
  locationLabel: string;
  searchTerm: string;
  selectedCategoryId: string;
  sort: MarketplaceSort;
  priceMin: string;
  priceMax: string;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  onOpenLocationPicker: () => void;
  onSearchTermChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: MarketplaceSort) => void;
  onUseMyLocation?: () => void;
  onApply: () => Promise<void>;
  onClear: () => Promise<void>;
  isDetectingLocation?: boolean;
}) {
  const sortedCategories = sortCategoriesByCatalog(categories);

  return (
    <section className="marketplace-filters" aria-label="Search and filter services">
      <header className="marketplace-filter-head">
        <p className="eyebrow">Search</p>
        <h2>Find the right service</h2>
        <p>Filter by location, category, search, and sort order.</p>
      </header>

      <div className="marketplace-filter-grid">
        <label className="marketplace-filter-location">
          Location
          <LocationTrigger
            locationLabel={locationLabel}
            isDetectingLocation={isDetectingLocation}
            onOpen={onOpenLocationPicker}
            onUseMyLocation={onUseMyLocation}
          />
        </label>
        <label>
          Category
          <select value={selectedCategoryId} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">All categories</option>
            {sortedCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Lekki, artisan, service"
          />
        </label>
        <label>
          Min price (₦)
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={priceMin}
            onChange={(event) => onPriceMinChange(event.target.value)}
            placeholder="500"
          />
        </label>
        <label>
          Max price (₦)
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={priceMax}
            onChange={(event) => onPriceMaxChange(event.target.value)}
            placeholder="50000"
          />
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(event) => onSortChange(event.target.value as MarketplaceSort)}>
            <option value="rating">Top rated</option>
            <option value="newest">Newest</option>
            <option value="price_low">Lowest price</option>
            <option value="price_high">Highest price</option>
            <option value="distance">Nearest to you</option>
          </select>
        </label>
      </div>

      {sort === 'distance' && onUseMyLocation ? (
        <p className="marketplace-filter-location-hint">
          <button type="button" className="marketplace-filter-link-button" onClick={onUseMyLocation}>
            Use my current location
          </button>{' '}
          for distance ranking, or pick a location above as your reference point.
        </p>
      ) : null}

      <div className="marketplace-filter-actions">
        <button
          type="button"
          className="marketplace-filter-button marketplace-filter-button--secondary"
          onClick={() => void onClear()}
        >
          Clear filters
        </button>
        <button
          type="button"
          className="marketplace-filter-button marketplace-filter-button--primary"
          onClick={() => void onApply()}
        >
          Apply filters
        </button>
      </div>
    </section>
  );
}
