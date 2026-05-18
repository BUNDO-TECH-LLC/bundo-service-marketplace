import { EmptyState } from '../components/EmptyState';
import { MarketplaceFilters, OfferingGrid } from '../app/appShellComponents';
import { nigeriaStates } from '../lib/geo';
import { useAppRoot } from '../app/appRootContext';

export default function MarketplacePage() {
  const ctx = useAppRoot();

  return (
    <main className="page">
      <section className="section-head">
        <p className="eyebrow">Book trusted help</p>
        <h1>Find skilled professionals near you</h1>
        <p>
          {ctx.selectedState || ctx.searchTerm
            ? `Browse approved artisans and offerings${ctx.selectedState ? ` in ${ctx.selectedState}` : ''}${ctx.searchTerm ? ` matching "${ctx.searchTerm}"` : ''}.`
            : 'Browse approved artisans, compare services, send a message, or place a booking request.'}
        </p>
      </section>

      <section className="toolbar" aria-label="Marketplace summary">
        {ctx.selectedState && <span>Location: {ctx.selectedState}</span>}
        {ctx.searchTerm && <span>Search: {ctx.searchTerm}</span>}
        {ctx.selectedCategoryId && (
          <span>
            Category: {ctx.categories.find((category) => category.id === ctx.selectedCategoryId)?.name || 'Selected'}
          </span>
        )}
        <span>{ctx.publicOfferings.length} services</span>
        <span>{ctx.artisans.length} artisans</span>
        <span>{ctx.categories.length} categories</span>
      </section>

      <MarketplaceFilters
        categories={ctx.categories}
        selectedState={ctx.selectedState}
        states={nigeriaStates}
        searchTerm={ctx.searchTerm}
        selectedCategoryId={ctx.selectedCategoryId}
        priceMin={ctx.priceMin}
        priceMax={ctx.priceMax}
        sort={ctx.marketplaceSort}
        onSelectedStateChange={ctx.setSelectedState}
        onSearchTermChange={ctx.setSearchTerm}
        onCategoryChange={ctx.setSelectedCategoryId}
        onPriceMinChange={ctx.setPriceMin}
        onPriceMaxChange={ctx.setPriceMax}
        onSortChange={ctx.setMarketplaceSort}
        onApply={() =>
          ctx.withNotice(
            async () => {
              await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm);
            },
            'Marketplace filters updated'
          )
        }
        onClear={async () => {
          ctx.setSelectedState('');
          ctx.setSearchTerm('');
          ctx.setSelectedCategoryId('');
          ctx.setPriceMin('');
          ctx.setPriceMax('');
          ctx.setMarketplaceSort('rating');
          await ctx.withNotice(
            async () => {
              await ctx.loadPublicData('', '', {
                categoryId: '',
                minPrice: '',
                maxPrice: '',
                sort: 'rating',
              });
            },
            'Marketplace filters cleared'
          );
        }}
      />

      <OfferingGrid
        offerings={ctx.publicOfferings}
        isAuthed={ctx.isAuthed}
        role={ctx.me?.role || null}
        token={ctx.token}
        busy={ctx.busy}
        runAction={ctx.withNotice}
        reloadPrivate={() => ctx.loadPrivateData()}
        onViewProfile={ctx.openArtisanProfile}
        onBookingSuccess={ctx.setBookingSuccess}
      />

      <section className="section-head compact">
        <h2>Approved artisans</h2>
        <p>Public profiles now respond to category, price, location, and sort signals to make discovery sharper.</p>
      </section>
      <div className="grid three">
        {ctx.artisans.length === 0 && (
          <EmptyState title="No artisans yet" body="Approve artisan profiles from admin to make them visible here." />
        )}
        {ctx.artisans.map((artisan) => (
          <article className="artisan-card" key={artisan.id}>
            <div className="avatar">{artisan.displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <h3>{artisan.displayName}</h3>
              <p>{artisan.bio || 'Trusted professional'}</p>
              <p className="muted">
                {artisan.city}
                {artisan.area ? `, ${artisan.area}` : ''}
              </p>
              <p className="rating">
                Rating {artisan.avgRating || 0} · {artisan.ratingCount} reviews
              </p>
              <button type="button" className="text-button" onClick={() => ctx.openArtisanProfile(artisan.id)}>
                View profile
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
