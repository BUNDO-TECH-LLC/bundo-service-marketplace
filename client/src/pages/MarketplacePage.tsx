import { EmptyState } from '../components/EmptyState';
import { MarketplaceFilters, OfferingGrid } from '../features/marketplace';
import { coordinatesForState } from '../lib/nigeriaStateCoordinates';
import { nigeriaStates } from '../lib/geo';
import { useAppRoot } from '../app/appRootContext';

export default function MarketplacePage() {
  const ctx = useAppRoot();

  function resolveSearchCoordinates() {
    if (ctx.searchLat != null && ctx.searchLng != null) {
      return { lat: ctx.searchLat, lng: ctx.searchLng };
    }

    if (ctx.selectedState) {
      return coordinatesForState(ctx.selectedState);
    }

    return null;
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      ctx.setNotice('Location is not available in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        ctx.setSearchCoordinates(position.coords.latitude, position.coords.longitude);
        ctx.setMarketplaceSort('distance');
        ctx.setNotice('Using your current location for nearest results.');
      },
      () => {
        ctx.setNotice('Could not read your location. Pick a state or allow location access.');
      },
      { enableHighAccuracy: false, timeout: 12_000 }
    );
  }

  async function applyFilters() {
    const coords = resolveSearchCoordinates();
    if (ctx.marketplaceSort === 'distance') {
      if (!coords) {
        ctx.setNotice('Choose a state or use your location before sorting by nearest.');
        return;
      }
      ctx.setSearchCoordinates(coords.lat, coords.lng);
    }

    await ctx.withNotice(
      async () => {
        await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm);
      },
      'Marketplace filters updated'
    );
  }

  return (
    <main className="page">
      <section className="section-head">
        <p className="eyebrow">Book trusted help</p>
        <h1>Find skilled professionals near you</h1>
        <p>
          {ctx.selectedState || ctx.searchTerm
            ? `Browse approved artisans and offerings${ctx.selectedState ? ` in ${ctx.selectedState}` : ''}${ctx.searchTerm ? ` matching "${ctx.searchTerm}"` : ''}.`
            : 'Browse approved artisans, compare services, and place a booking request.'}
        </p>
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
        onSelectedStateChange={(state) => {
          ctx.setSelectedState(state);
          if (state) {
            const coords = coordinatesForState(state);
            ctx.setSearchCoordinates(coords.lat, coords.lng);
          }
        }}
        onSearchTermChange={ctx.setSearchTerm}
        onCategoryChange={ctx.setSelectedCategoryId}
        onPriceMinChange={ctx.setPriceMin}
        onPriceMaxChange={ctx.setPriceMax}
        onSortChange={ctx.setMarketplaceSort}
        onUseMyLocation={() => {
          useMyLocation();
        }}
        onApply={applyFilters}
        onClear={async () => {
          ctx.setSelectedState('');
          ctx.setSearchTerm('');
          ctx.setSelectedCategoryId('');
          ctx.setPriceMin('');
          ctx.setPriceMax('');
          ctx.setMarketplaceSort('rating');
          ctx.setSearchCoordinates(null, null);
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
        role={ctx.me?.role ?? null}
        token={ctx.token}
        busy={ctx.busy}
        runAction={ctx.withNotice}
        reloadPrivate={() => ctx.loadPrivateData()}
        onViewProfile={ctx.openArtisanProfile}
        onBookingSuccess={ctx.setBookingSuccess}
      />

      {ctx.publicOfferings.length === 0 && (
        <EmptyState
          title="No matching services"
          body="Try clearing filters, choosing another state, or browsing without distance sorting."
        />
      )}
    </main>
  );
}
