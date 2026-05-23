import type { Category } from '../../types';
import { curatedCategoryCards, resolveCuratedCategory } from './curatedCategories';

export function ServicesSection({
  categories,
  onBrowse,
}: {
  categories: Category[];
  onBrowse: (categoryId?: string) => void | Promise<void>;
}) {
  return (
    <section className="services services-curated">
      <div className="section-title-row services-curated-title-row">
        <div className="services-curated-head">
          <h2>Curated Categories</h2>
          <p className="services-curated-sub">Specialists for every corner of your residence.</p>
        </div>
        <button type="button" className="services-explore-all" onClick={() => void onBrowse()}>
          Explore All <span aria-hidden>→</span>
        </button>
      </div>
      <div className="services-curated-grid">
        {curatedCategoryCards.map((row) => {
          const matched = resolveCuratedCategory(categories, row.matchSlugs);
          return (
            <button
              key={row.title}
              type="button"
              className="services-category-card"
              onClick={() => void onBrowse(matched?.id)}
            >
              <span className="services-category-icon-tile" aria-hidden>
                {row.icon}
              </span>
              <span className="services-category-card-title">{row.title}</span>
              <span className="services-category-card-desc">{row.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

