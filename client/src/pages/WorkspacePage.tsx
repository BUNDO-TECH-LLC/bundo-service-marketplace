import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BundoLoadingScreen } from '../components/BundoLoadingScreen';
import { EmptyState } from '../components/EmptyState';
import { AccountSettingsHub } from '../features/account/AccountSettingsHub';
import { ArtisanOffersPanel, ArtisanProfileSettings, ArtisanReviewsPanel } from '../features/artisan';
import { api } from '../lib/api';
import { isArtisanApplicant, ARTISAN_ONBOARDING_PATH, hasArtisanApplicantSubmittedVerification } from '../lib/artisanApplication';
import type { ApiUser } from '../types';
import { artisanVerificationPhase } from '../lib/artisanVerification';
import { buildAppPath, buildArtisanBookingPath } from '../lib/appPaths';
import { firebaseReady } from '../lib/firebase';
import type { Artisan, ArtisanKycSubmission } from '../types';
import { BookingsPage } from '../panels/BookingsPanel';
import { ChatPanel } from '../panels/ChatPanel';
import { NotificationsPanel } from '../panels/NotificationsPanel';
import { ArtisanDashboard } from '../views/ArtisanDashboard';
import { LoggedInHome } from '../views/LoggedInHome';
import { useAppRoot } from '../app/appRootContext';
import { SIGN_IN_UNAVAILABLE_WITH_EMAIL } from '../lib/productionMessages';

export default function WorkspacePage() {
  const ctx = useAppRoot();
  const { workspaceSection, me, firebaseUser } = ctx;

  const isApplicant = Boolean(me && isArtisanApplicant(me, { email: firebaseUser?.email }));
  const applicantWorkspace = isApplicant && hasArtisanApplicantSubmittedVerification(me?.firebaseUid);
  const artisanWorkspace = me?.role === 'ARTISAN' || applicantWorkspace;

  if (isApplicant && !applicantWorkspace) {
    return <Navigate to={ARTISAN_ONBOARDING_PATH} replace />;
  }

  const artisanGateCheckedRef = useRef(false);
  const [artisanGate, setArtisanGate] = useState<'checking' | 'allowed' | 'blocked'>(() => {
    if (me?.role !== 'ARTISAN' || !me.firebaseUid) {
      return 'allowed';
    }

    const cached = sessionStorage.getItem(`bundo:artisan-gate:${me.firebaseUid}`);
    return cached === 'approved' ? 'allowed' : 'checking';
  });

  useEffect(() => {
    if (me?.role !== 'ARTISAN' || !me.firebaseUid) {
      setArtisanGate('allowed');
      artisanGateCheckedRef.current = false;
      return;
    }

    const cacheKey = `bundo:artisan-gate:${me.firebaseUid}`;
    if (sessionStorage.getItem(cacheKey) === 'approved') {
      setArtisanGate('allowed');
      artisanGateCheckedRef.current = true;
      return;
    }

    if (artisanGateCheckedRef.current) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [profileRes, kycRes] = await Promise.all([
          api<{ profile: Artisan }>('/artisans/me', { token: ctx.token }),
          api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token: ctx.token }),
        ]);

        if (cancelled) return;

        const phase = artisanVerificationPhase({
          profile: profileRes.profile || null,
          kycStatus: kycRes.submission?.status ?? 'NOT_SUBMITTED',
          hydrated: true,
        });

        if (phase === 'approved') {
          sessionStorage.setItem(cacheKey, 'approved');
          artisanGateCheckedRef.current = true;
          setArtisanGate('allowed');
          return;
        }

        sessionStorage.removeItem(cacheKey);
        setArtisanGate('blocked');
        ctx.setNotice('Your profile is awaiting approval. You can check status from your dashboard.');
        ctx.navigate('/');
      } catch {
        if (!cancelled) {
          setArtisanGate('allowed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ctx, me?.role, me?.firebaseUid, ctx.token]);

  if (me?.role === 'ARTISAN' && artisanGate === 'checking') {
    return <BundoLoadingScreen />;
  }

  if (me?.role === 'ARTISAN' && artisanGate === 'blocked') {
    return null;
  }

  return (
    <main
      className={`page workspace-page ${workspaceSection === 'messages' ? 'messages-workspace' : ''} ${artisanWorkspace ? 'artisan-workspace-page' : ''}`}
    >
      {workspaceSection !== 'messages' && !artisanWorkspace && workspaceSection !== 'settings' && (
        <section className="section-head">
          <p className="eyebrow">Workspace</p>
          <h1>
            {workspaceSection === 'bookings'
              ? 'Bookings'
              : workspaceSection === 'offers'
                ? 'Manage offers'
                : 'Manage your Bundo account'}
          </h1>
          <p>
            {workspaceSection === 'bookings'
              ? 'Track service requests and booking activity.'
              : workspaceSection === 'offers'
                ? 'Update your artisan profile and service listings.'
                : firebaseUser
                  ? firebaseUser.email
                  : 'Sign in to manage profile settings, bookings, messages, and account updates.'}
          </p>
        </section>
      )}

      {!firebaseReady && (
        <div className="notice warning">
          {SIGN_IN_UNAVAILABLE_WITH_EMAIL}
        </div>
      )}

      {!me && (
        <EmptyState
          title="Sign in to continue"
          body="Use the login form in the header, then choose customer or artisan to unlock the matching workspace."
        />
      )}

      {me && workspaceSection === 'messages' && (
        <ChatPanel
          token={ctx.token}
          currentUserId={me.firebaseUid}
          conversations={ctx.conversations}
          busy={ctx.busy}
          runAction={ctx.withNotice}
          refreshConversations={() => ctx.loadConversations()}
        />
      )}

      {me && workspaceSection === 'bookings' && (
        <BookingsPage
          bookings={ctx.bookings}
          mode={me.role === 'ARTISAN' ? 'artisan' : 'customer'}
          token={ctx.token}
          busy={ctx.busy}
          runAction={ctx.withNotice}
          refresh={() => ctx.loadPrivateData()}
          openMessages={() => ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'messages' }))}
        />
      )}

      {me && workspaceSection === 'offers' && artisanWorkspace && (
        <ArtisanOffersPanel
          token={ctx.token}
          categories={ctx.categoryOptions}
          offerings={ctx.myOfferings}
          busy={ctx.busy}
          runAction={ctx.withNotice}
          refresh={async () => {
            await ctx.loadPublicData();
            await ctx.loadPrivateData();
          }}
        />
      )}

      {me && workspaceSection === 'offers' && !artisanWorkspace && (
        <EmptyState
          title="Artisan tools"
          body="Apply as an artisan from profile settings, then complete KYC and wait for admin approval before listing offers."
        />
      )}

      {me && workspaceSection === 'notifications' && (
        <NotificationsPanel
          token={ctx.token}
          notifications={ctx.notifications}
          busy={ctx.busy}
          runAction={ctx.withNotice}
          refresh={() => ctx.loadPrivateData()}
          onNavigate={(path) => ctx.navigate(path)}
        />
      )}

      {me && workspaceSection === 'reviews' && artisanWorkspace && <ArtisanReviewsPanel token={ctx.token} />}

      {me && workspaceSection === 'profile' && artisanWorkspace && (
        <ArtisanProfileSettings
          token={ctx.token}
          busy={ctx.busy}
          runAction={ctx.withNotice}
          refresh={() => ctx.loadPrivateData()}
          onNavigate={(path) => ctx.navigate(path)}
        />
      )}

      {me && workspaceSection === 'settings' && (
        <AccountSettingsHub
          token={ctx.token}
          me={me}
          firebaseUser={ctx.firebaseUser}
          busy={ctx.busy}
          runAction={ctx.withNotice}
          refresh={async () => {
            const response = await api<{ user: ApiUser }>('/me', { token: ctx.token });
            ctx.setMe(response.user);
            await ctx.loadPrivateData();
          }}
          onNavigate={(path) => ctx.navigate(path)}
          onNotice={ctx.setNotice}
          pushStatus={ctx.pushStatus}
          pushEnabled={Boolean(ctx.pushToken)}
          enablePushAlerts={ctx.enablePushAlerts}
        />
      )}

      {me && workspaceSection === 'overview' && (
        <>
          {artisanWorkspace ? (
            <ArtisanDashboard
              token={ctx.token}
              bookings={ctx.bookings}
              firebaseUser={ctx.firebaseUser}
              busy={ctx.busy}
              runAction={ctx.withNotice}
              refresh={() => ctx.loadPrivateData()}
              openBookings={() => ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }))}
              openProfile={() => ctx.navigate(buildAppPath({ view: 'workspace', workspaceSection: 'profile' }))}
              openBookingDetail={(bookingId) => ctx.navigate(buildArtisanBookingPath(bookingId))}
            />
          ) : (
            <LoggedInHome
              me={me}
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
                    locationId: ctx.locationId || undefined,
                    area: ctx.selectedArea || undefined,
                  });
                  ctx.navigate('/marketplace');
                }, categoryId ? 'Category selected' : 'Opening marketplace');
              }}
              onSearch={async () => {
                await ctx.withNotice(async () => {
                  await ctx.loadPublicData(ctx.selectedState, ctx.searchTerm, {
                    locationId: ctx.locationId || undefined,
                    area: ctx.selectedArea || undefined,
                  });
                  ctx.navigate('/marketplace');
                }, ctx.searchTerm.trim() ? `Searching for ${ctx.searchTerm.trim()}` : 'Showing available services');
              }}
              onViewProfile={ctx.openArtisanProfile}
              runAction={ctx.withNotice}
              reloadPrivate={() => ctx.loadPrivateData()}
              onBookingSuccess={ctx.setBookingSuccess}
            />
          )}
        </>
      )}
    </main>
  );
}
