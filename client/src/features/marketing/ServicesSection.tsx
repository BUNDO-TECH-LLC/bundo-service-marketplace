import type { Category } from '../../types';
import {
  HOMEPAGE_POPULAR_CATEGORY_LIMIT,
  listPopularCatalogCategories,
} from '../../lib/serviceCategoryCatalog';
import { ServiceCategoryIcon } from '../../lib/serviceCategoryIcons';

export function ServicesSection({
  categories,
  onBrowse,
}: {
  categories: Category[];
  onBrowse: (categoryId?: string) => void | Promise<void>;
}) {
  const cards = listPopularCatalogCategories(categories, HOMEPAGE_POPULAR_CATEGORY_LIMIT);

  return (
    <section className="services services-curated">
      <div className="section-title-row services-curated-title-row">
        <div className="services-curated-head">
          <h2>Popular service categories</h2>
          <p className="services-curated-sub">Top booked trades on Bundo — explore more from the marketplace.</p>
        </div>
        <button type="button" className="services-explore-all" onClick={() => void onBrowse()}>
          Explore All <span aria-hidden>→</span>
        </button>
      </div>
      <div className="services-curated-grid services-curated-grid--popular">
        {cards.map((row) => (
          <button
            key={row.slug}
            type="button"
            className="services-category-card"
            onClick={() => void onBrowse(row.category.id)}
          >
            <span className="services-category-icon-tile" aria-hidden>
              <ServiceCategoryIcon iconKey={row.iconKey} />
            </span>
            <span className="services-category-card-title">{row.name}</span>
            <span className="services-category-card-desc">{row.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
