import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AppPromo, Footer, Hero, ServicesSection, WhySection } from '../features/marketing';
import { MarketplacePreview } from '../features/marketplace';
import { buildAppPath } from '../lib/appPaths';
import {
  ARTISAN_ONBOARDING_PATH,
  clearArtisanApplicant,
  isApprovedArtisanSession,
  isArtisanApplicant,
} from '../lib/artisanApplication';
import { locationErrorMessage } from '../lib/geolocation';
import { nigeriaStates } from '../lib/geo';
import { LoggedInHome } from '../views/LoggedInHome';
import { useAppRoot } from '../app/appRootContext';

export default function HomePage() {
  const ctx = useAppRoot();

  useEffect(() => {
    if (!ctx.me) {
      return;
    }

    if (ctx.me.role === 'CUSTOMER' && isArtisanApplicant(ctx.me, { email: ctx.firebaseUser?.email })) {
      ctx.navigate(ARTISAN_ONBOARDING_PATH, { replace: true });
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
      return <Navigate to={ARTISAN_ONBOARDING_PATH} replace />;
    }

    return (
      <LoggedInHome
        me={ctx.me}
        firebaseUser={ctx.firebaseUser}
        categories={ctx.categories}
        offerings={ctx.publicOfferings}
        artisans={ctx.artisans}
        selectedState={ctx.selectedState}
        searchTerm={ctx.searchTerm}
        token={ctx.token}
        busy={ctx.busy}
        onSearchTermChange={ctx.setSearchTerm}
        onSelectedStateChange={ctx.setSelectedState}
        onBrowse={async (categoryId) => {
          ctx.setSelectedCategoryId(categoryId || '');
          await ctx.withNotice(async () => {
            await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm, { categoryId: categoryId || '' });
            ctx.navigate('/marketplace');
          }, categoryId ? 'Category selected' : 'Opening marketplace');
        }}
        onSearch={async () => {
          await ctx.withNotice(async () => {
            await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm);
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
        selectedState={ctx.selectedState}
        states={nigeriaStates}
        isDetectingLocation={ctx.isDetectingLocation}
        onStateChange={async (state) => {
          ctx.setSelectedState(state);
          await ctx.withNotice(async () => {
            await ctx.loadPublicData(state, ctx.searchTerm);
            ctx.navigate('/marketplace');
          }, state ? `Showing services in ${state}` : 'Showing all services');
        }}
        searchTerm={ctx.searchTerm}
        onSearchTermChange={ctx.setSearchTerm}
        onSearch={async (state, queryText) => {
          ctx.setSelectedState(state);
          ctx.setSearchTerm(queryText);
          await ctx.withNotice(async () => {
            await ctx.loadPublicData(state, queryText);
            ctx.navigate('/marketplace');
          }, queryText.trim() ? `Searching for ${queryText.trim()}` : 'Showing available services');
        }}
        onBrowse={() => ctx.navigate('/marketplace')}
        onBecomeArtisan={() => ctx.navigate('/signup?role=artisan')}
        onUseMyLocation={() => {
          void ctx.useMyLocation().then((result) => {
            if (result.ok) {
              ctx.setSearchCoordinates(result.lat, result.lng);
              ctx.setNotice(`Showing services near ${result.state}.`);
              void ctx.loadPublicData(result.state, ctx.searchTerm, {
                lat: result.lat,
                lng: result.lng,
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
            await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm, { categoryId: id || undefined });
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
