import { money } from '../../lib/formatting';
import type { Offering } from '../../types';

export function MarketplacePreview({ offerings, onBrowse }: { offerings: Offering[]; onBrowse: () => void }) {
  return (
    <section className="preview-band">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Marketplace</p>
          <h2>Ready to book</h2>
        </div>
        <button onClick={onBrowse}>Open marketplace</button>
      </div>
      <div className="grid three">
        {offerings.slice(0, 3).map((offering) => (
          <article className="service-card" key={offering.id}>
            <p className="pill">{offering.category?.name || 'Service'}</p>
            <h3>{offering.title}</h3>
            <p>{offering.artisan?.displayName || 'Approved artisan'}</p>
            <p className="price">{money(offering.priceFrom)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

