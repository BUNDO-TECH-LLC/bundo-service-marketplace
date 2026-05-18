import { createContext, useContext, type ReactNode } from 'react';
import type { NavigateFunction, Location } from 'react-router-dom';
import type { User } from 'firebase/auth';
import type {
  ActionRunner,
  AdminArtisanRecord,
  AdminCategoryRecord,
  AdminSection,
  AdminUserRecord,
  BookingSuccessState,
  MarketplaceSort,
  PushStatus,
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
  adminKycSubmissions: ArtisanKycSubmission[];
  adminUsers: AdminUserRecord[];
  adminArtisans: AdminArtisanRecord[];
  adminCategories: AdminCategoryRecord[];
  selectedState: string;
  setSelectedState: (value: string) => void;
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
  notice: string;
  setNotice: (value: string) => void;
  bookingSuccess: BookingSuccessState | null;
  setBookingSuccess: (value: BookingSuccessState | null) => void;
  busy: boolean;
  isAuthed: boolean;
  isAppBootstrapping: boolean;
  usesArtisanSetupHeader: boolean;
  usesArtisanWorkspaceHeader: boolean;
  hideGlobalHeader: boolean;
  artisanHeaderActive: 'Dashboard' | 'Jobs' | 'Messages' | 'Reviews';
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
    }
  ) => Promise<void>;
  loadPrivateData: (authToken?: string, user?: ApiUser | null) => Promise<void>;
  openArtisanProfile: (artisanId: string) => Promise<void>;
  enablePushAlerts: () => Promise<void>;
  firebaseReady: boolean;
  pushStatus: PushStatus;
  pushToken: string;
  routeHydrated: boolean;
  setRouteHydrated: (value: boolean) => void;
  setToken: (value: string) => void;
  setMe: (value: ApiUser | null) => void;
};

export const AppRootContext = createContext<AppRootValue | null>(null);

export function useAppRoot(): AppRootValue {
  const value = useContext(AppRootContext);
  if (!value) {
    throw new Error('useAppRoot must be used within AppRootContext.Provider');
  }
  return value;
}
