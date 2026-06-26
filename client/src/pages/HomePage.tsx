import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AppPromo, Footer, Hero, ServicesSection, WhySection } from '../features/marketing';
import { MarketplacePreview } from '../features/marketplace';
import { buildAuthDrawerSearch } from '../lib/authDrawerPrompt';
import { buildAppPath } from '../lib/appPaths';
import {
  ARTISAN_ONBOARDING_PATH,
  artisanApplicantHomePath,
  clearArtisanApplicant,
  isApprovedArtisanSession,
  isArtisanApplicant,
} from '../lib/artisanApplication';
import { locationErrorMessage } from '../lib/geolocation';
import { LoggedInHome } from '../views/LoggedInHome';
import { useAppRoot } from '../app/appRootContext';

function marketplaceLoadOptions(ctx: ReturnType<typeof useAppRoot>) {
  return {
    locationId: ctx.locationId || undefined,
    area: ctx.selectedArea || undefined,
  };
}

export default function HomePage() {
  const ctx = useAppRoot();

  useEffect(() => {
    if (!ctx.me) {
      return;
    }

    if (ctx.me.role === 'CUSTOMER' && isArtisanApplicant(ctx.me, { email: ctx.firebaseUser?.email })) {
      ctx.navigate(artisanApplicantHomePath(ctx.me, { email: ctx.firebaseUser?.email }), { replace: true });
    }
  }, [ctx.me, ctx.firebaseUser?.email, ctx.navigate]);

  if (ctx.isAuthed && ctx.me) {
    if (ctx.me.role === 'ARTISAN') {
      clearArtisanApplicant(ctx.me.firebaseUid);
      if (isApprovedArtisanSession(ctx.me.firebaseUid)) {
        return <Navigate to="/workspace/overview" replace />;
      }
      return <Navigate to="/artisan/onboarding" replace />;
    }

    if (ctx.me.role === 'CUSTOMER' && isArtisanApplicant(ctx.me, { email: ctx.firebaseUser?.email })) {
      return <Navigate to={artisanApplicantHomePath(ctx.me, { email: ctx.firebaseUser?.email })} replace />;
    }

    return (
      <LoggedInHome
        me={ctx.me}
        firebaseUser={ctx.firebaseUser}
        categories={ctx.categories}
        offerings={ctx.publicOfferings}
        artisans={ctx.artisans}
        locationLabel={ctx.locationLabel}
        searchTerm={ctx.searchTerm}
        token={ctx.token}
        busy={ctx.busy}
        isDetectingLocation={ctx.isDetectingLocation}
        onSearchTermChange={ctx.setSearchTerm}
        onOpenLocationPicker={ctx.openLocationPicker}
        onBrowse={async (categoryId) => {
          ctx.setSelectedCategoryId(categoryId || '');
          await ctx.withNotice(async () => {
            await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm, {
              categoryId: categoryId || '',
              ...marketplaceLoadOptions(ctx),
            });
            ctx.navigate('/marketplace');
          }, categoryId ? 'Category selected' : 'Opening marketplace');
        }}
        onSearch={async () => {
          await ctx.withNotice(async () => {
            await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm, marketplaceLoadOptions(ctx));
            ctx.navigate('/marketplace');
          }, ctx.searchTerm.trim() ? `Searching for ${ctx.searchTerm.trim()}` : 'Showing available services');
        }}
        onViewProfile={ctx.openArtisanProfile}
        runAction={ctx.withNotice}
        reloadPrivate={() => ctx.loadPrivateData()}
        onBookingSuccess={ctx.setBookingSuccess}
      />
    );
  }

  return (
    <main>
      <Hero
        locationLabel={ctx.locationLabel}
        isDetectingLocation={ctx.isDetectingLocation}
        onOpenLocationPicker={ctx.openLocationPicker}
        searchTerm={ctx.searchTerm}
        onSearchTermChange={ctx.setSearchTerm}
        onSearch={async (queryText) => {
          ctx.setSearchTerm(queryText);
          await ctx.withNotice(async () => {
            await ctx.loadPublicData(ctx.selectedState, queryText, marketplaceLoadOptions(ctx));
            ctx.navigate('/marketplace');
          }, queryText.trim() ? `Searching for ${queryText.trim()}` : 'Showing available services');
        }}
        onBrowse={() => ctx.navigate('/marketplace')}
        onBecomeArtisan={() =>
          ctx.navigate({ pathname: '/', search: buildAuthDrawerSearch({ mode: 'signup', role: 'ARTISAN' }) })
        }
        onUseMyLocation={() => {
          void ctx.useMyLocation().then((result) => {
            if (result.ok) {
              ctx.setSearchCoordinates(result.lat, result.lng);
              ctx.setNotice(`Showing services near ${result.state}.`);
              void ctx.loadPublicData(result.state, ctx.searchTerm, {
                lat: result.lat,
                lng: result.lng,
                locationId: ctx.locationId || undefined,
              });
              return;
            }
            ctx.setNotice(
              locationErrorMessage(result.reason, { permissionGranted: result.permissionGranted })
            );
          });
        }}
      />
      <WhySection />
      <ServicesSection
        categories={ctx.categories}
        onBrowse={async (categoryId) => {
          const id = categoryId ?? '';
          ctx.setSelectedCategoryId(id);
          await ctx.withNotice(async () => {
            await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm, {
              categoryId: id || undefined,
              ...marketplaceLoadOptions(ctx),
            });
            ctx.navigate('/marketplace');
          }, id ? 'Category selected' : 'Opening marketplace');
        }}
      />
      <MarketplacePreview offerings={ctx.publicOfferings} onBrowse={() => ctx.navigate('/marketplace')} />
      <AppPromo />
      <Footer
        onOpenHelpTopic={(topicId) => {
          ctx.navigate(buildAppPath({ view: 'help', helpTopicId: topicId }), { state: { helpBack: '/' } });
        }}
      />
    </main>
  );
}
