import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ArtisanHeaderActive, BookingSuccessState, PaymentSuccessState } from '../appTypes';
import { isAuthPathname } from '../lib/appRouting';
import { firebaseReady } from '../lib/firebase';
import { useActionRunner } from '../hooks/useActionRunner';
import { useAppAuth } from '../hooks/useAppAuth';
import { useAppData } from '../hooks/useAppData';
import { useAppPush } from '../hooks/useAppPush';
import { useAppRouteSync } from '../hooks/useAppRouteSync';
import { useMarketplaceFilters } from '../hooks/useMarketplaceFilters';
import type { ApiUser } from '../types';
import { AppRootContext, type AppRootValue } from './appRootContext';

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { busy, notice, setNotice, withNotice } = useActionRunner();
  const marketplaceFilters = useMarketplaceFilters();
  const appData = useAppData(marketplaceFilters);
  const [bookingSuccess, setBookingSuccess] = useState<BookingSuccessState | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessState | null>(null);
  const processedPaymentReferenceRef = useRef<string | null>(null);

  const completePaymentReturn = async (reference: string, authToken: string, user: ApiUser) => {
    const success = await appData.completePaymentReturn(reference, authToken, user);
    setPaymentSuccess(success);
    setNotice('Payment confirmed. Your booking is now secured.');
    return success;
  };

  const auth = useAppAuth({
    navigate,
    loadPrivateData: appData.loadPrivateData,
    clearPrivateData: appData.clearPrivateData,
    completePaymentReturn,
    setNotice,
    processedPaymentReferenceRef,
  });

  const routeSync = useAppRouteSync({
    location,
    navigate,
    authChecked: auth.authChecked,
    token: auth.token,
    me: auth.me,
    firebaseUser: auth.firebaseUser,
    selectedArtisan: appData.selectedArtisan,
    setSelectedArtisan: appData.setSelectedArtisan,
    setSelectedArtisanReviews: appData.setSelectedArtisanReviews,
    setNotice,
    completePaymentReturn,
    isAuthed: Boolean(auth.firebaseUser && auth.token),
    routeHydrated: auth.routeHydrated,
    processedPaymentReferenceRef,
  });

  const { enablePushAlerts } = useAppPush({
    isAuthed: Boolean(auth.firebaseUser && auth.token),
    token: auth.token,
    me: auth.me,
    pushToken: auth.pushToken,
    setPushToken: auth.setPushToken,
    setPushStatus: auth.setPushStatus,
    setNotice,
    loadPrivateData: appData.loadPrivateData,
    currentTokenRef: auth.currentTokenRef,
  });

  useEffect(() => {
    appData.loadPublicData().catch(() => setNotice('Could not load marketplace data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial marketplace load once
  }, []);

  const isAuthed = Boolean(auth.firebaseUser && auth.token);
  const onAuthScreen = isAuthPathname(location.pathname);
  const isRestoringAuthedRoute =
    isAuthed && Boolean(auth.me?.role) && !auth.routeHydrated && !onAuthScreen;
  const isAppBootstrapping = !auth.authChecked || isRestoringAuthedRoute;
  const usesArtisanSetupHeader = isAuthed && auth.me?.role === 'ARTISAN' && routeSync.view === 'home';
  const usesArtisanWorkspaceHeader = isAuthed && auth.me?.role === 'ARTISAN' && routeSync.view === 'workspace';
  const hideGlobalHeader =
    isAuthed && (auth.me?.role === 'ADMIN' || usesArtisanSetupHeader || usesArtisanWorkspaceHeader);

  const artisanHeaderActive: ArtisanHeaderActive =
    routeSync.workspaceSection === 'bookings'
      ? 'Jobs'
      : routeSync.workspaceSection === 'messages'
        ? 'Messages'
        : routeSync.workspaceSection === 'reviews'
          ? 'Reviews'
          : routeSync.workspaceSection === 'offers'
            ? 'Offers'
            : routeSync.workspaceSection === 'notifications'
              ? 'Notifications'
              : routeSync.workspaceSection === 'profile'
                ? 'Profile'
                : 'Dashboard';

  const categoryOptions = useMemo(
    (): ReactNode[] =>
      appData.categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      )),
    [appData.categories]
  );

  async function openArtisanProfile(artisanId: string) {
    navigate(`/artisans/${artisanId}`);
  }

  const loadPrivateData = (authToken?: string, user?: ApiUser | null) =>
    appData.loadPrivateData(authToken ?? '', user);

  const rootValue: AppRootValue = {
    navigate,
    location,
    view: routeSync.view,
    workspaceSection: routeSync.workspaceSection,
    adminSection: routeSync.adminSection,
    activeHelpTopicId: routeSync.activeHelpTopicId,
    firebaseUser: auth.firebaseUser,
    token: auth.token,
    me: auth.me,
    categories: appData.categories,
    artisans: appData.artisans,
    publicOfferings: appData.publicOfferings,
    myOfferings: appData.myOfferings,
    selectedArtisan: appData.selectedArtisan,
    selectedArtisanReviews: appData.selectedArtisanReviews,
    bookings: appData.bookings,
    conversations: appData.conversations,
    notifications: appData.notifications,
    adminConversations: appData.adminConversations,
    adminStats: appData.adminStats,
    adminBookings: appData.adminBookings,
    adminBookingsTotal: appData.adminBookingsTotal,
    adminKycSubmissions: appData.adminKycSubmissions,
    adminUsers: appData.adminUsers,
    adminArtisans: appData.adminArtisans,
    adminCategories: appData.adminCategories,
    selectedState: marketplaceFilters.selectedState,
    setSelectedState: marketplaceFilters.setSelectedState,
    searchTerm: marketplaceFilters.searchTerm,
    setSearchTerm: marketplaceFilters.setSearchTerm,
    selectedCategoryId: marketplaceFilters.selectedCategoryId,
    setSelectedCategoryId: marketplaceFilters.setSelectedCategoryId,
    priceMin: marketplaceFilters.priceMin,
    setPriceMin: marketplaceFilters.setPriceMin,
    priceMax: marketplaceFilters.priceMax,
    setPriceMax: marketplaceFilters.setPriceMax,
    marketplaceSort: marketplaceFilters.marketplaceSort,
    setMarketplaceSort: marketplaceFilters.setMarketplaceSort,
    searchLat: marketplaceFilters.searchLat,
    searchLng: marketplaceFilters.searchLng,
    setSearchCoordinates: marketplaceFilters.setSearchCoordinates,
    notice,
    setNotice,
    bookingSuccess,
    setBookingSuccess,
    paymentSuccess,
    setPaymentSuccess,
    busy,
    isAuthed,
    isAppBootstrapping,
    usesArtisanSetupHeader,
    usesArtisanWorkspaceHeader,
    hideGlobalHeader,
    artisanHeaderActive,
    categoryOptions,
    withNotice,
    loadPublicData: appData.loadPublicData,
    loadPrivateData,
    openArtisanProfile,
    enablePushAlerts,
    firebaseReady,
    pushStatus: auth.pushStatus,
    pushToken: auth.pushToken,
    routeHydrated: auth.routeHydrated,
    setRouteHydrated: auth.setRouteHydrated,
    setToken: auth.setToken,
    setMe: auth.setMe,
  };

  return <AppRootContext.Provider value={rootValue}>{children}</AppRootContext.Provider>;
}
