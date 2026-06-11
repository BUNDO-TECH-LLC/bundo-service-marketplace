import type { Category } from '../../types';
import { listCatalogCategories } from '../../lib/serviceCategoryCatalog';
import { ServiceCategoryIcon } from '../../lib/serviceCategoryIcons';

export function ServicesSection({
  categories,
  onBrowse,
}: {
  categories: Category[];
  onBrowse: (categoryId?: string) => void | Promise<void>;
}) {
  const cards = listCatalogCategories(categories);

  return (
    <section className="services services-curated">
      <div className="section-title-row services-curated-title-row">
        <div className="services-curated-head">
          <h2>Service categories</h2>
          <p className="services-curated-sub">Book trusted professionals across every home and trade service.</p>
        </div>
        <button type="button" className="services-explore-all" onClick={() => void onBrowse()}>
          Explore All <span aria-hidden>→</span>
        </button>
      </div>
      <div className="services-curated-grid">
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
