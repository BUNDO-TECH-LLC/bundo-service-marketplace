import type { ApiUser, Artisan, ArtisanKycSubmission, Category, Offering, Review, Role } from './types';

export type View = 'home' | 'marketplace' | 'workspace' | 'admin' | 'help' | 'artisan-profile';
export type WorkspaceSection = 'overview' | 'bookings' | 'messages' | 'offers' | 'notifications' | 'reviews' | 'profile';
export type AdminSection = 'overview' | 'profiles' | 'jobs' | 'messages' | 'verification' | 'catalog';
export type ActionRunner = (action: () => Promise<void>, done?: string) => Promise<void>;
export type PushStatus = 'idle' | 'unsupported' | 'missing-config' | 'unavailable' | 'enabled' | 'denied';
export type MarketplaceSort = 'newest' | 'rating' | 'price_low' | 'price_high';
export type SignupRole = Extract<Role, 'CUSTOMER' | 'ARTISAN'>;
export type BookingSuccessState = {
  bookingId?: string;
  serviceTitle: string;
  artisanName: string;
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
  _count?: {
    offerings: number;
    bookingsReceived: number;
    reviewsReceived: number;
  };
};
export type AdminCategoryRecord = Category & {
  _count?: {
    offerings: number;
  };
};
