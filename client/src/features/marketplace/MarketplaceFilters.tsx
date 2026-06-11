import type { MarketplaceSort } from '../../appTypes';
import type { Category } from '../../types';

export function MarketplaceFilters({
  categories,
  selectedState,
  states,
  searchTerm,
  selectedCategoryId,
  priceMin,
  priceMax,
  sort,
  onSelectedStateChange,
  onSearchTermChange,
  onCategoryChange,
  onPriceMinChange,
  onPriceMaxChange,
  onSortChange,
  onUseMyLocation,
  onApply,
  onClear,
}: {
  categories: Category[];
  selectedState: string;
  states: string[];
  searchTerm: string;
  selectedCategoryId: string;
  priceMin: string;
  priceMax: string;
  sort: MarketplaceSort;
  onSelectedStateChange: (value: string) => void;
  onSearchTermChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  onSortChange: (value: MarketplaceSort) => void;
  onUseMyLocation?: () => void;
  onApply: () => Promise<void>;
  onClear: () => Promise<void>;
}) {
  return (
    <section className="marketplace-filters" aria-label="Search and filter services">
      <header className="marketplace-filter-head">
        <p className="eyebrow">Search</p>
        <h2>Find the right service</h2>
        <p>Filter by location, category, price, and sort order.</p>
      </header>

      <div className="marketplace-filter-grid">
        <label>
          State
          <select value={selectedState} onChange={(event) => onSelectedStateChange(event.target.value)}>
            <option value="">All states</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={selectedCategoryId} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
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
            placeholder="Artisan, service, category"
          />
        </label>
        <label>
          Min price
          <input
            type="number"
            min="0"
            value={priceMin}
            onChange={(event) => onPriceMinChange(event.target.value)}
            placeholder="₦5,000"
          />
        </label>
        <label>
          Max price
          <input
            type="number"
            min="0"
            value={priceMax}
            onChange={(event) => onPriceMaxChange(event.target.value)}
            placeholder="₦50,000"
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
          for distance ranking, or pick a state above as your reference point.
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
