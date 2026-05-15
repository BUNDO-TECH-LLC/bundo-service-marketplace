import { money } from '../../lib/formatting';
import type { Offering } from '../../types';

type MarketplacePreviewSectionProps = {
  offerings: Offering[];
  onBrowseMarketplace: () => void;
  onViewProfile: (artisanId: string) => void;
};

export function MarketplacePreviewSection({
  offerings,
  onBrowseMarketplace,
  onViewProfile,
}: MarketplacePreviewSectionProps) {
  return (
    <section className="px-6 py-12 lg:px-[7vw] xl:px-28">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-accent-bright)]">
            Marketplace preview
          </p>
          <h2 className="m-0 text-[34px] font-medium text-[var(--color-ink)]">Approved artisans customers can book today.</h2>
        </div>
        <button className="bg-transparent text-base font-semibold text-[var(--color-accent-bright)]" type="button" onClick={onBrowseMarketplace}>
          Open marketplace
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {offerings.map((offering) => (
          <article
            className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-[0_14px_36px_var(--shadow-light)]"
            key={offering.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-accent-bright)]">
                  {offering.category?.name || 'Service'}
                </p>
                <h3 className="mt-2 mb-1 text-xl font-semibold text-[var(--color-ink)]">{offering.title}</h3>
                <p className="m-0 text-sm text-[var(--color-text-sub)]">
                  {offering.artisan?.displayName || 'Approved artisan'}
                </p>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent-wash)] text-sm font-bold text-[var(--color-accent-bright)]">
                {(offering.artisan?.displayName || offering.title).slice(0, 1).toUpperCase()}
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-[var(--color-text-sub)]">
              {offering.description || 'A public service listing customers can compare and book on Bundo.'}
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <strong className="text-lg text-[var(--color-ink)]">From {money(offering.priceFrom)}</strong>
              {offering.artisan?.id ? (
                <button className="bg-transparent text-sm font-semibold text-[var(--color-accent-bright)]" type="button" onClick={() => onViewProfile(offering.artisan!.id)}>
                  View profile
                </button>
              ) : (
                <button className="bg-transparent text-sm font-semibold text-[var(--color-accent-bright)]" type="button" onClick={onBrowseMarketplace}>
                  Browse more
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
