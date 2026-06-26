import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ArtisanHeaderActive, AdminSection, BookingSuccessState, PaymentSuccessState } from '../appTypes';
import { isAuthPathname, needsPublicMarketplaceData } from '../lib/appRouting';
import { ApiError } from '../lib/api';
import { firebaseReady } from '../lib/firebase';
import { useActionRunner } from '../hooks/useActionRunner';
import { useAppAuth } from '../hooks/useAppAuth';
import { useAppData } from '../hooks/useAppData';
import { useAppPush } from '../hooks/useAppPush';
import { useAppRouteSync } from '../hooks/useAppRouteSync';
import { mergeAuthDrawerIntoSearch } from '../lib/authDrawerPrompt';
import { isArtisanApplicant, hasArtisanApplicantSubmittedVerification } from '../lib/artisanApplication';
import { useMarketplaceFilters } from '../hooks/useMarketplaceFilters';
import { useUserLocation } from '../hooks/useUserLocation';
import { shouldSeedBrowseFromProfile } from '../lib/syncBrowseLocationFromProfile';
import { LocationPicker } from '../components/LocationPicker';
import type { ApiUser } from '../types';
import type { LocationListItem } from '../types/location';
import { AppRootContext, type AppRootValue } from './appRootContext';

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { busy, notice, setNotice, withNotice } = useActionRunner();
  const marketplaceFilters = useMarketplaceFilters();
  const userLocation = useUserLocation();
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const profileLocationSeededRef = useRef(false);
  const filterState = useMemo(
    () => ({
      selectedState: userLocation.selectedState,
      selectedArea: userLocation.selectedArea,
      locationId: userLocation.locationId,
      searchTerm: marketplaceFilters.searchTerm,
      selectedCategoryId: marketplaceFilters.selectedCategoryId,
      priceMin: marketplaceFilters.priceMin,
      priceMax: marketplaceFilters.priceMax,
      marketplaceSort: marketplaceFilters.marketplaceSort,
      searchLat: userLocation.searchLat,
      searchLng: userLocation.searchLng,
    }),
    [
      userLocation.selectedState,
      userLocation.selectedArea,
      userLocation.locationId,
      userLocation.searchLat,
      userLocation.searchLng,
      marketplaceFilters.searchTerm,
      marketplaceFilters.selectedCategoryId,
      marketplaceFilters.priceMin,
      marketplaceFilters.priceMax,
      marketplaceFilters.marketplaceSort,
    ]
  );
  const appData = useAppData(filterState, { notifyConversationError: (msg) => setNotice(msg) });
  const [bookingSuccess, setBookingSuccess] = useState<BookingSuccessState | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessState | null>(null);
  const [manualAuthInProgress, setManualAuthInProgress] = useState(false);
  const processedPaymentReferenceRef = useRef<string | null>(null);

  const completePaymentReturn = useCallback(async (reference: string, authToken: string, user: ApiUser) => {
    const success = await appData.completePaymentReturn(reference, authToken, user);
    setPaymentSuccess(success);
    setNotice('Payment confirmed. Your booking is now secured.');
    return success;
  }, [appData.completePaymentReturn, setNotice]);

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
    loadNotifications: appData.loadNotifications,
    currentTokenRef: auth.currentTokenRef,
  });

  useEffect(() => {
    if (!needsPublicMarketplaceData(location.pathname)) {
      return;
    }

    appData.loadPublicData().catch((error) => {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Could not load marketplace data. Check your connection and try again.';
      setNotice(message);
    });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- reload when entering marketplace routes

  useEffect(() => {
    if (!needsPublicMarketplaceData(location.pathname)) {
      return;
    }

    appData
      .loadPublicData(userLocation.selectedState, marketplaceFilters.searchTerm)
      .catch((error) => {
        const message =
          error instanceof ApiError
            ? error.message
            : 'Could not refresh services for your location.';
        setNotice(message);
      });
  }, [
    userLocation.selectedState,
    userLocation.selectedArea,
    userLocation.locationId,
    userLocation.searchLat,
    userLocation.searchLng,
    location.pathname,
    appData.loadPublicData,
    setNotice,
  ]);

  useEffect(() => {
    if (!auth.me || profileLocationSeededRef.current) {
      return;
    }

    if (!shouldSeedBrowseFromProfile(auth.me)) {
      profileLocationSeededRef.current = true;
      return;
    }

    profileLocationSeededRef.current = true;
    userLocation.applyProfileLocation(auth.me.state ?? '', auth.me.area);
  }, [auth.me, userLocation.applyProfileLocation]);

  const handleLocationPickerSelect = useCallback(
    (item: LocationListItem) => {
      userLocation.applyLocationSelection(item);
    },
    [userLocation.applyLocationSelection]
  );

  const openLocationPicker = useCallback(() => {
    setLocationPickerOpen(true);
  }, []);

  const isAuthed = Boolean(auth.firebaseUser && auth.token);
  const onAuthScreen = isAuthPathname(location.pathname);
  const isAuthSyncing = Boolean(auth.firebaseUser) && (!auth.token || !auth.me);
  const isRestoringAuthedRoute =
    isAuthed && Boolean(auth.me?.role) && !auth.routeHydrated && !onAuthScreen;
  const isAppBootstrapping =
    !onAuthScreen &&
    !manualAuthInProgress &&
    (!auth.authChecked || isAuthSyncing || isRestoringAuthedRoute);
  const onArtisanOnboardingRoute = location.pathname.startsWith('/artisan/onboarding');
  const usesArtisanSetupHeader =
    isAuthed &&
    onArtisanOnboardingRoute &&
    (auth.me?.role === 'ARTISAN' ||
      (auth.me?.role === 'CUSTOMER' && isArtisanApplicant(auth.me)));
  const applicantWorkspaceMode =
    auth.me?.role === 'CUSTOMER' &&
    isArtisanApplicant(auth.me) &&
    hasArtisanApplicantSubmittedVerification(auth.me.firebaseUid);
  const usesArtisanWorkspaceHeader =
    isAuthed &&
    (auth.me?.role === 'ARTISAN' || applicantWorkspaceMode) &&
    routeSync.view === 'workspace';
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
                : routeSync.workspaceSection === 'settings'
                  ? 'Settings'
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

  const openArtisanProfile = useCallback(
    async (artisanId: string) => {
      navigate(`/artisans/${artisanId}`);
    },
    [navigate]
  );

  const promptCustomerLogin = useCallback(() => {
    setNotice('Sign in as a customer to book this service.');
    navigate({
      pathname: location.pathname,
      search: mergeAuthDrawerIntoSearch(location.search, { mode: 'login', role: 'CUSTOMER' }),
    });
  }, [location.pathname, location.search, navigate, setNotice]);

  const loadPrivateData = useCallback(
    (authToken?: string, user?: ApiUser | null) =>
      appData.loadPrivateData(authToken ?? auth.token, user ?? auth.me ?? undefined),
    [appData.loadPrivateData, auth.token, auth.me]
  );

  const loadConversations = useCallback(
    (authToken?: string) => appData.loadConversations(authToken ?? auth.token),
    [appData.loadConversations, auth.token]
  );

  const loadAdminSection = useCallback(
    (section: AdminSection, authToken?: string) =>
      appData.loadAdminSection(authToken ?? auth.token, section),
    [appData.loadAdminSection, auth.token]
  );

  const refreshAdminSection = useCallback(
    async (section: AdminSection) => {
      await appData.loadAdminEssentials(auth.token);
      await appData.loadAdminSection(auth.token, section);
    },
    [appData.loadAdminEssentials, appData.loadAdminSection, auth.token]
  );

  const rootValue: AppRootValue = useMemo(() => ({
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
    selectedState: userLocation.selectedState,
    selectedArea: userLocation.selectedArea,
    locationId: userLocation.locationId,
    locationLabel: userLocation.locationLabel,
    setSelectedState: userLocation.setSelectedState,
    applyLocationSelection: userLocation.applyLocationSelection,
    applyProfileLocation: userLocation.applyProfileLocation,
    openLocationPicker,
    locationSource: userLocation.locationSource,
    isDetectingLocation: userLocation.isDetectingLocation,
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
    searchLat: userLocation.searchLat,
    searchLng: userLocation.searchLng,
    setSearchCoordinates: userLocation.setSearchCoordinates,
    useMyLocation: userLocation.useMyLocation,
    clearLocation: userLocation.clearLocation,
    notice,
    setNotice,
    bookingSuccess,
    setBookingSuccess,
    paymentSuccess,
    setPaymentSuccess,
    busy,
    isAuthed,
    authChecked: auth.authChecked,
    manualAuthInProgress,
    setManualAuthInProgress,
    isAppBootstrapping,
    usesArtisanSetupHeader,
    usesArtisanWorkspaceHeader,
    hideGlobalHeader,
    artisanHeaderActive,
    categoryOptions,
    withNotice,
    loadPublicData: appData.loadPublicData,
    loadPrivateData,
    loadConversations,
    loadAdminSection,
    refreshAdminSection,
    openArtisanProfile,
    promptCustomerLogin,
    enablePushAlerts,
    firebaseReady,
    pushStatus: auth.pushStatus,
    pushToken: auth.pushToken,
    routeHydrated: auth.routeHydrated,
    setRouteHydrated: auth.setRouteHydrated,
    setToken: auth.setToken,
    setMe: auth.setMe,
    acknowledgeSession: auth.acknowledgeSession,
  }), [
    navigate,
    location,
    routeSync.view,
    routeSync.workspaceSection,
    routeSync.adminSection,
    routeSync.activeHelpTopicId,
    auth.firebaseUser,
    auth.token,
    auth.me,
    auth.authChecked,
    manualAuthInProgress,
    auth.pushStatus,
    auth.pushToken,
    auth.routeHydrated,
    auth.setRouteHydrated,
    auth.setToken,
    auth.setMe,
    auth.acknowledgeSession,
    appData.categories,
    appData.artisans,
    appData.publicOfferings,
    appData.myOfferings,
    appData.selectedArtisan,
    appData.selectedArtisanReviews,
    appData.bookings,
    appData.conversations,
    appData.notifications,
    appData.adminConversations,
    appData.adminStats,
    appData.adminBookings,
    appData.adminBookingsTotal,
    appData.adminKycSubmissions,
    appData.adminUsers,
    appData.adminArtisans,
    appData.adminCategories,
    appData.loadPublicData,
    userLocation.selectedState,
    userLocation.selectedArea,
    userLocation.locationId,
    userLocation.locationLabel,
    userLocation.setSelectedState,
    userLocation.applyLocationSelection,
    userLocation.applyProfileLocation,
    openLocationPicker,
    userLocation.locationSource,
    userLocation.isDetectingLocation,
    userLocation.searchLat,
    userLocation.searchLng,
    userLocation.setSearchCoordinates,
    userLocation.useMyLocation,
    userLocation.clearLocation,
    marketplaceFilters.searchTerm,
    marketplaceFilters.setSearchTerm,
    marketplaceFilters.selectedCategoryId,
    marketplaceFilters.setSelectedCategoryId,
    marketplaceFilters.priceMin,
    marketplaceFilters.setPriceMin,
    marketplaceFilters.priceMax,
    marketplaceFilters.setPriceMax,
    marketplaceFilters.marketplaceSort,
    marketplaceFilters.setMarketplaceSort,
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
    loadPrivateData,
    loadConversations,
    loadAdminSection,
    refreshAdminSection,
    openArtisanProfile,
    promptCustomerLogin,
    enablePushAlerts,
  ]);

  return (
    <AppRootContext.Provider value={rootValue}>
      {children}
      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={handleLocationPickerSelect}
      />
    </AppRootContext.Provider>
  );
}
