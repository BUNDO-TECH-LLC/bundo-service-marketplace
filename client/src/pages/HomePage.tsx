import {
  AppPromo,
  ArtisanLanding,
  Footer,
  Hero,
  MarketplacePreview,
  ServicesSection,
  WhySection,
} from '../app/appShellComponents';
import { buildAppPath } from '../lib/appPaths';
import { nigeriaStates } from '../lib/geo';
import { LoggedInHome } from '../views/LoggedInHome';
import { useAppRoot } from '../app/appRootContext';

export default function HomePage() {
  const ctx = useAppRoot();

  if (ctx.isAuthed && ctx.me) {
    if (ctx.me.role === 'ARTISAN') {
      return (
        <ArtisanLanding
          token={ctx.token}
          categories={ctx.categories}
          offerings={ctx.myOfferings}
          bookings={ctx.bookings}
          firebaseUser={ctx.firebaseUser}
          busy={ctx.busy}
          runAction={ctx.withNotice}
          refresh={async () => {
            await ctx.loadPublicData();
            await ctx.loadPrivateData();
          }}
          openBookings={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }));
          }}
          openMessages={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'messages' }));
          }}
          openReviews={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'reviews' }));
          }}
          openProfile={() => {
            ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'profile' }));
          }}
        />
      );
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
        openBookings={() => {
          ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }));
        }}
      />
    );
  }

  return (
    <main>
      <Hero
        selectedState={ctx.selectedState}
        states={nigeriaStates}
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
