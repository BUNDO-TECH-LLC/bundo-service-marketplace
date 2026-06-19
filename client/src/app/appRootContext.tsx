import { createContext, useContext, type ReactNode } from 'react';
import type { NavigateFunction, Location } from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { UseMyLocationResult } from '../lib/geolocation';
import type {
  ActionRunner,
  AdminArtisanRecord,
  AdminCategoryRecord,
  AdminSection,
  AdminUserRecord,
  BookingSuccessState,
  PaymentSuccessState,
  LocationSource,
  MarketplaceSort,
  PushStatus,
  ArtisanHeaderActive,
  View,
  WorkspaceSection,
} from '../appTypes';
import type {
  ApiUser,
  Artisan,
  ArtisanKycSubmission,
  Booking,
  Category,
  Conversation,
  Notification,
  Offering,
  Review,
} from '../types';

export type AppRootValue = {
  navigate: NavigateFunction;
  location: Location;
  view: View;
  workspaceSection: WorkspaceSection;
  adminSection: AdminSection;
  activeHelpTopicId: string | null;
  firebaseUser: User | null;
  token: string;
  me: ApiUser | null;
  categories: Category[];
  artisans: Artisan[];
  publicOfferings: Offering[];
  myOfferings: Offering[];
  selectedArtisan: Artisan | null;
  selectedArtisanReviews: Review[];
  bookings: Booking[];
  conversations: Conversation[];
  notifications: Notification[];
  adminConversations: Conversation[];
  adminStats: Record<string, number> | null;
  adminBookings: Booking[];
  adminBookingsTotal: number;
  adminKycSubmissions: ArtisanKycSubmission[];
  adminUsers: AdminUserRecord[];
  adminArtisans: AdminArtisanRecord[];
  adminCategories: AdminCategoryRecord[];
  selectedState: string;
  setSelectedState: (value: string) => void;
  locationSource: LocationSource;
  isDetectingLocation: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (value: string) => void;
  priceMin: string;
  setPriceMin: (value: string) => void;
  priceMax: string;
  setPriceMax: (value: string) => void;
  marketplaceSort: MarketplaceSort;
  setMarketplaceSort: (value: MarketplaceSort) => void;
  searchLat: number | null;
  searchLng: number | null;
  setSearchCoordinates: (lat: number | null, lng: number | null) => void;
  useMyLocation: () => Promise<UseMyLocationResult>;
  clearLocation: () => void;
  notice: string;
  setNotice: (value: string) => void;
  bookingSuccess: BookingSuccessState | null;
  setBookingSuccess: (value: BookingSuccessState | null) => void;
  paymentSuccess: PaymentSuccessState | null;
  setPaymentSuccess: (value: PaymentSuccessState | null) => void;
  busy: boolean;
  isAuthed: boolean;
  authChecked: boolean;
  manualAuthInProgress: boolean;
  setManualAuthInProgress: (value: boolean) => void;
  isAppBootstrapping: boolean;
  usesArtisanSetupHeader: boolean;
  usesArtisanWorkspaceHeader: boolean;
  hideGlobalHeader: boolean;
  artisanHeaderActive: ArtisanHeaderActive;
  categoryOptions: ReactNode[];
  withNotice: ActionRunner;
  loadPublicData: (
    state?: string,
    queryText?: string,
    options?: {
      categoryId?: string;
      minPrice?: string;
      maxPrice?: string;
      sort?: MarketplaceSort;
      lat?: number;
      lng?: number;
    }
  ) => Promise<void>;
  loadPrivateData: (authToken?: string, user?: ApiUser | null) => Promise<void>;
  loadConversations: (authToken?: string) => Promise<void>;
  loadAdminSection: (section: AdminSection, authToken?: string) => Promise<void>;
  refreshAdminSection: (section: AdminSection) => Promise<void>;
  openArtisanProfile: (artisanId: string) => Promise<void>;
  promptCustomerLogin: () => void;
  enablePushAlerts: () => Promise<void>;
  firebaseReady: boolean;
  pushStatus: PushStatus;
  pushToken: string;
  routeHydrated: boolean;
  setRouteHydrated: (value: boolean) => void;
  setToken: (value: string) => void;
  setMe: (value: ApiUser | null) => void;
  acknowledgeSession: (token: string, user: ApiUser) => void;
};

export const AppRootContext = createContext<AppRootValue | null>(null);

export function useAppRoot(): AppRootValue {
  const value = useContext(AppRootContext);
  if (!value) {
    throw new Error('useAppRoot must be used within AppRootContext.Provider');
  }
  return value;
}
