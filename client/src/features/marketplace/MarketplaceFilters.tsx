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
  onApply: () => Promise<void>;
  onClear: () => Promise<void>;
}) {
  return (
    <section className="marketplace-filters">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Refine results</p>
          <h2>Search with more control</h2>
        </div>
      </div>
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
          <input type="number" min="0" value={priceMin} onChange={(event) => onPriceMinChange(event.target.value)} placeholder="5000" />
        </label>
        <label>
          Max price
          <input type="number" min="0" value={priceMax} onChange={(event) => onPriceMaxChange(event.target.value)} placeholder="50000" />
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(event) => onSortChange(event.target.value as MarketplaceSort)}>
            <option value="rating">Top rated</option>
            <option value="newest">Newest</option>
            <option value="price_low">Lowest price</option>
            <option value="price_high">Highest price</option>
          </select>
        </label>
      </div>
      <div className="marketplace-filter-actions">
        <button onClick={() => void onApply()}>Apply filters</button>
        <button className="secondary-button" onClick={() => void onClear()}>
          Clear
        </button>
      </div>
    </section>
  );
}

