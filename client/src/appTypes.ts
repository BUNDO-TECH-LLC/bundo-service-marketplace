import type { ApiUser, Artisan, ArtisanKycSubmission, Category, Offering, PortfolioImage, Review, Role } from './types';

export type View =
  | 'home'
  | 'marketplace'
  | 'workspace'
  | 'admin'
  | 'help'
  | 'artisan-profile'
  | 'artisan-onboarding';
export type WorkspaceSection =
  | 'overview'
  | 'bookings'
  | 'messages'
  | 'offers'
  | 'notifications'
  | 'reviews'
  | 'profile'
  | 'settings';
export type AccountSettingsSection =
  | 'personal'
  | 'verification'
  | 'payouts'
  | 'phone'
  | 'email'
  | 'language'
  | 'notifications'
  | 'password'
  | 'delete';
export type ArtisanHeaderActive =
  | 'Dashboard'
  | 'Jobs'
  | 'Messages'
  | 'Reviews'
  | 'Offers'
  | 'Notifications'
  | 'Profile'
  | 'Settings';
export type AdminSection =
  | 'overview'
  | 'profiles'
  | 'jobs'
  | 'messages'
  | 'verification'
  | 'catalog'
  | 'reviews'
  | 'finance';
export type ActionRunner = (action: () => Promise<void>, done?: string) => Promise<void>;
export type PushStatus = 'idle' | 'unsupported' | 'missing-config' | 'unavailable' | 'enabled' | 'denied';
export type MarketplaceSort = 'newest' | 'rating' | 'price_low' | 'price_high' | 'distance';

export type NotificationPreferences = {
  bookings: boolean;
  messages: boolean;
  marketing: boolean;
};
export type SignupRole = Extract<Role, 'CUSTOMER' | 'ARTISAN'>;
export type BookingSuccessState = {
  bookingId: string;
  artisanId: string;
  serviceTitle: string;
  artisanName: string;
  scheduledAt: string;
  location: string;
};

export type PaymentSuccessState = {
  bookingId: string;
  serviceTitle: string;
  artisanName: string;
  amount: number;
};
export type AdminUserRecord = ApiUser & {
  artisanProfile?: {
    id: string;
    displayName: string;
    verifyStatus: Artisan['verifyStatus'];
  } | null;
};
export type AdminArtisanRecord = Artisan & {
  user?: Pick<ApiUser, 'firebaseUid' | 'email' | 'phone' | 'role' | 'status'>;
  portfolioImages?: PortfolioImage[];
  _count?: {
    offerings: number;
    bookingsReceived: number;
    reviewsReceived: number;
    portfolioImages?: number;
  };
};
export type AdminCategoryRecord = Category & {
  _count?: {
    offerings: number;
  };
};
