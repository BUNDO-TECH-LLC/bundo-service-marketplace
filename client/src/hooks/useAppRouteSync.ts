import { useEffect, useState, type MutableRefObject } from 'react';
import type { User } from 'firebase/auth';
import type { NavigateFunction, Location } from 'react-router-dom';
import { api } from '../lib/api';
import { buildAppPath, parseAppPath } from '../lib/appPaths';
import { isAuthPathname } from '../lib/appRouting';
import { auth } from '../lib/firebase';
import { isArtisanApplicant } from '../lib/artisanApplication';
import { routeStorageKey } from '../lib/workspaceRoute';
import type { AdminSection, View, WorkspaceSection } from '../appTypes';
import type { ApiUser, Artisan, Review } from '../types';

export function useAppRouteSync({
  location,
  navigate,
  authChecked,
  token,
  me,
  firebaseUser,
  selectedArtisan,
  setSelectedArtisan,
  setSelectedArtisanReviews,
  setNotice,
  completePaymentReturn,
  isAuthed,
  routeHydrated,
  processedPaymentReferenceRef,
}: {
  location: Location;
  navigate: NavigateFunction;
  authChecked: boolean;
  token: string;
  me: ApiUser | null;
  firebaseUser: User | null;
  selectedArtisan: Artisan | null;
  setSelectedArtisan: (value: Artisan | null) => void;
  setSelectedArtisanReviews: (value: Review[]) => void;
  setNotice: (message: string) => void;
  completePaymentReturn: (reference: string, token: string, user: ApiUser) => Promise<unknown>;
  isAuthed: boolean;
  routeHydrated: boolean;
  processedPaymentReferenceRef: MutableRefObject<string | null>;
}) {
  const [view, setView] = useState<View>('home');
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('overview');
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
  const [activeHelpTopicId, setActiveHelpTopicId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthPathname(location.pathname)) {
      return;
    }

    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/terms' || path === '/privacy') {
      return;
    }

    const parsed = parseAppPath(location.pathname);
    if (!parsed) {
      navigate('/', { replace: true });
      return;
    }

    const firebaseProvisional = Boolean(auth?.currentUser);

    if (
      authChecked &&
      (parsed.view === 'workspace' || parsed.view === 'admin') &&
      !firebaseProvisional &&
      !firebaseUser &&
      !token
    ) {
      navigate('/', { replace: true });
      return;
    }

    if (parsed.view === 'admin' && me && me.role !== 'ADMIN') {
      navigate('/', { replace: true });
      return;
    }

    if (
      parsed.view === 'artisan-onboarding' &&
      authChecked &&
      !firebaseProvisional &&
      !firebaseUser &&
      !token
    ) {
      navigate('/', { replace: true });
      return;
    }

    if (
      parsed.view === 'artisan-onboarding' &&
      me?.role === 'CUSTOMER' &&
      !isArtisanApplicant(me)
    ) {
      navigate('/', { replace: true });
      return;
    }

    if (parsed.view !== 'artisan-profile') {
      setSelectedArtisan(null);
      setSelectedArtisanReviews([]);
    }

    setView(parsed.view);
    setWorkspaceSection(parsed.workspaceSection);
    setAdminSection(parsed.adminSection);
    setActiveHelpTopicId(parsed.helpTopicId);
  }, [
    authChecked,
    firebaseUser,
    location.pathname,
    me,
    navigate,
    token,
    setSelectedArtisan,
    setSelectedArtisanReviews,
  ]);

  useEffect(() => {
    const parsed = parseAppPath(location.pathname);
    if (!parsed || parsed.view !== 'artisan-profile' || !parsed.artisanId) {
      return;
    }

    const id = parsed.artisanId;
    if (selectedArtisan?.id === id) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [artisanRes, reviewRes] = await Promise.all([
          api<{ artisan: Artisan }>(`/artisans/${id}`),
          api<{ reviews: Review[] }>(`/artisans/${id}/reviews`),
        ]);
        if (cancelled) return;
        setSelectedArtisan(artisanRes.artisan);
        setSelectedArtisanReviews(reviewRes.reviews);
      } catch {
        if (!cancelled) {
          setNotice('Could not load artisan profile');
          navigate('/marketplace', { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate, selectedArtisan?.id, setNotice, setSelectedArtisan, setSelectedArtisanReviews]);

  useEffect(() => {
    if (!authChecked || !token || !me) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference || processedPaymentReferenceRef.current === reference) {
      return;
    }

    processedPaymentReferenceRef.current = reference;
    let cancelled = false;

    void (async () => {
      try {
        await completePaymentReturn(reference, token, me);
      } catch {
        if (!cancelled) {
          setNotice(
            'Payment could not be confirmed yet. Open Bookings to check status or try again.'
          );
        }
      } finally {
        if (!cancelled) {
          navigate(buildAppPath({ view: 'workspace', workspaceSection: 'bookings' }), {
            replace: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authChecked, completePaymentReturn, location.search, me, navigate, setNotice, token]);

  useEffect(() => {
    if (!isAuthed || !me?.role || !routeHydrated) return;

    const routeToStore =
      me.role === 'ARTISAN' && view === 'home'
        ? { view: 'workspace' as View, workspaceSection: 'overview' as WorkspaceSection, adminSection }
        : { view, workspaceSection, adminSection };

    window.localStorage.setItem(routeStorageKey, JSON.stringify(routeToStore));
  }, [adminSection, isAuthed, me?.role, routeHydrated, view, workspaceSection]);

  return {
    view,
    workspaceSection,
    adminSection,
    activeHelpTopicId,
  };
}
