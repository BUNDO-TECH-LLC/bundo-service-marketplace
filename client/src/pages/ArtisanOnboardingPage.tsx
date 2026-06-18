import { Navigate } from 'react-router-dom';
import { ArtisanLanding } from '../features/artisan/ArtisanLanding';
import { buildAppPath } from '../lib/appPaths';
import { isArtisanApplicant } from '../lib/artisanApplication';
import { useAppRoot } from '../app/appRootContext';

export default function ArtisanOnboardingPage() {
  const ctx = useAppRoot();

  if (!ctx.isAuthed || !ctx.me) {
    return <Navigate to="/" replace />;
  }

  if (ctx.me.role === 'ADMIN') {
    return <Navigate to="/admin/overview" replace />;
  }

  const isApplicant = ctx.me.role === 'CUSTOMER' && isArtisanApplicant(ctx.me);

  if (ctx.me.role === 'CUSTOMER' && !isApplicant) {
    return <Navigate to="/" replace />;
  }

  return (
    <ArtisanLanding
      me={ctx.me}
      token={ctx.token}
      categories={ctx.categories}
      offerings={ctx.myOfferings}
      bookings={ctx.bookings}
      firebaseUser={ctx.firebaseUser}
      busy={ctx.busy}
      runAction={ctx.withNotice}
      refresh={async () => {
        await ctx.loadPublicData();
        await ctx.loadPrivateData(ctx.token, ctx.me);
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
