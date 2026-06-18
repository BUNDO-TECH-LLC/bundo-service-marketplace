import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BundoLoadingScreen } from '../components/BundoLoadingScreen';
import { ArtisanLanding } from '../features/artisan/ArtisanLanding';
import { buildAppPath } from '../lib/appPaths';
import { ensureArtisanApplicantOnServer, isArtisanApplicant } from '../lib/artisanApplication';
import { useAppRoot } from '../app/appRootContext';

export default function ArtisanOnboardingPage() {
  const ctx = useAppRoot();
  const [intentReady, setIntentReady] = useState(
    () => ctx.me?.role === 'ARTISAN' || ctx.me?.onboardingIntent === 'ARTISAN'
  );

  useEffect(() => {
    if (!ctx.isAuthed || !ctx.me || ctx.me.role !== 'CUSTOMER') {
      return;
    }

    if (ctx.me.onboardingIntent === 'ARTISAN') {
      setIntentReady(true);
      return;
    }

    let cancelled = false;

    void ensureArtisanApplicantOnServer(ctx.token, ctx.me.firebaseUid)
      .then((updated) => {
        if (cancelled) return;
        if (updated) {
          ctx.acknowledgeSession(ctx.token, updated);
        }
        setIntentReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        ctx.setNotice(
          error instanceof Error
            ? error.message
            : 'Could not start artisan onboarding. Refresh the page and try again.'
        );
        setIntentReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.isAuthed, ctx.me, ctx.token, ctx.acknowledgeSession, ctx.setNotice]);

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

  if (!intentReady) {
    return <BundoLoadingScreen />;
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
