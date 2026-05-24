import { useCallback, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { isArtisanApplicantSession } from '../lib/artisanApplication';
import { paymentSuccessFromVerify, type VerifyPaymentResponse } from '../lib/paymentReturn';
import type {
  AdminArtisanRecord,
  AdminCategoryRecord,
  AdminSection,
  AdminUserRecord,
  MarketplaceSort,
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

type MarketplaceFilterState = {
  selectedState: string;
  searchTerm: string;
  selectedCategoryId: string;
  priceMin: string;
  priceMax: string;
  marketplaceSort: MarketplaceSort;
  searchLat: number | null;
  searchLng: number | null;
};

export type UseAppDataOptions = {
  /** Called when GET /conversations fails (except 401). Stops silent empty inbox when the API errors. */
  notifyConversationError?: (message: string) => void;
};

function conversationsFallback(
  err: unknown,
  notifyConversationError?: (message: string) => void
): { conversations: Conversation[] } {
  if (notifyConversationError && err instanceof ApiError && err.status !== 401) {
    notifyConversationError(err.message);
  }
  return { conversations: [] };
}

export function useAppData(filters: MarketplaceFilterState, options?: UseAppDataOptions) {
  const notifyConversationError = options?.notifyConversationError;
  const [categories, setCategories] = useState<Category[]>([]);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [publicOfferings, setPublicOfferings] = useState<Offering[]>([]);
  const [myOfferings, setMyOfferings] = useState<Offering[]>([]);
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);
  const [selectedArtisanReviews, setSelectedArtisanReviews] = useState<Review[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [adminConversations, setAdminConversations] = useState<Conversation[]>([]);
  const [adminStats, setAdminStats] = useState<Record<string, number> | null>(null);
  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);
  const [adminBookingsTotal, setAdminBookingsTotal] = useState(0);
  const [adminKycSubmissions, setAdminKycSubmissions] = useState<ArtisanKycSubmission[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminArtisans, setAdminArtisans] = useState<AdminArtisanRecord[]>([]);
  const [adminCategories, setAdminCategories] = useState<AdminCategoryRecord[]>([]);

  const loadPublicData = useCallback(
    async (
      state = filters.selectedState,
      queryText = filters.searchTerm,
      options?: {
        categoryId?: string;
        minPrice?: string;
        maxPrice?: string;
        sort?: MarketplaceSort;
      }
    ) => {
      const params = new URLSearchParams({ page: '1', limit: '12' });
      const nextCategoryId = options?.categoryId ?? filters.selectedCategoryId;
      const nextMinPrice = options?.minPrice ?? filters.priceMin;
      const nextMaxPrice = options?.maxPrice ?? filters.priceMax;
      const nextSort = options?.sort ?? filters.marketplaceSort;

      if (state) params.set('state', state);
      if (queryText.trim()) params.set('q', queryText.trim());
      if (nextCategoryId) params.set('categoryId', nextCategoryId);
      if (nextMinPrice.trim()) params.set('minPrice', nextMinPrice.trim());
      if (nextMaxPrice.trim()) params.set('maxPrice', nextMaxPrice.trim());
      if (nextSort) params.set('sort', nextSort);
      if (
        nextSort === 'distance' &&
        filters.searchLat != null &&
        filters.searchLng != null
      ) {
        params.set('lat', String(filters.searchLat));
        params.set('lng', String(filters.searchLng));
      }

      const query = `?${params.toString()}`;
      const categoryPromise = api<{ categories: Category[] }>('/categories');
      const marketplacePromise = Promise.all([
        api<{ artisans: Artisan[] }>(`/artisans${query}`),
        api<{ offerings: Offering[] }>(`/offerings${query}`),
      ]);

      const [categoryRes, [artisanRes, offeringRes]] = await Promise.all([
        categoryPromise,
        marketplacePromise,
      ]);
      setCategories(categoryRes.categories);
      setArtisans(artisanRes.artisans);
      setPublicOfferings(offeringRes.offerings);
    },
    [filters]
  );

  const loadConversations = useCallback(
    async (authToken: string) => {
      const conversationRes = await api<{ conversations: Conversation[] }>('/conversations', {
        token: authToken,
      }).catch((err) => conversationsFallback(err, notifyConversationError));
      setConversations(conversationRes.conversations);
    },
    [notifyConversationError]
  );

  const loadAdminEssentials = useCallback(async (authToken: string) => {
    const [stats, notificationRes] = await Promise.all([
      api<{ stats: Record<string, number> }>('/admin/stats', { token: authToken }),
      api<{ notifications: Notification[] }>('/notifications', { token: authToken }).catch(() => ({
        notifications: [],
      })),
    ]);
    setAdminStats(stats.stats);
    setNotifications(notificationRes.notifications);
  }, []);

  const loadAdminSection = useCallback(async (authToken: string, section: AdminSection) => {
    switch (section) {
      case 'overview':
        return;
      case 'profiles': {
        const [userRes, artisanRes] = await Promise.all([
          api<{ users: AdminUserRecord[] }>('/admin/users?page=1&limit=100', { token: authToken }),
          api<{ artisans: AdminArtisanRecord[] }>('/admin/artisans?page=1&limit=24', {
            token: authToken,
          }),
        ]);
        setAdminUsers(userRes.users);
        setAdminArtisans(artisanRes.artisans);
        return;
      }
      case 'jobs': {
        const bookingRes = await api<{ bookings: Booking[]; meta: { total: number } }>(
          '/admin/bookings?page=1&limit=200',
          { token: authToken }
        );
        setAdminBookings(bookingRes.bookings);
        setAdminBookingsTotal(bookingRes.meta?.total ?? bookingRes.bookings.length);
        return;
      }
      case 'messages': {
        const conversationRes = await api<{ conversations: Conversation[] }>(
          '/admin/conversations?page=1&limit=20',
          { token: authToken }
        );
        setAdminConversations(conversationRes.conversations);
        return;
      }
      case 'verification': {
        const kycRes = await api<{ submissions: ArtisanKycSubmission[] }>(
          '/admin/kyc-submissions?page=1&limit=12',
          { token: authToken }
        );
        setAdminKycSubmissions(kycRes.submissions);
        return;
      }
      case 'catalog': {
        const categoryRes = await api<{ categories: AdminCategoryRecord[] }>(
          '/admin/categories?page=1&limit=24',
          { token: authToken }
        );
        setAdminCategories(categoryRes.categories);
        return;
      }
      case 'reviews':
      case 'finance':
        return;
      default:
        return;
    }
  }, []);

  const loadPrivateData = useCallback(async (authToken: string, user: ApiUser | null | undefined) => {
    if (!authToken || !user?.role) return;

    if (user.role === 'CUSTOMER') {
      const [bookingRes, conversationRes, notificationRes] = await Promise.all([
        api<{ bookings: Booking[] }>('/bookings/customer?page=1&limit=10', { token: authToken }).catch(() => ({
          bookings: [],
        })),
        api<{ conversations: Conversation[] }>('/conversations', { token: authToken }).catch((err) =>
          conversationsFallback(err, notifyConversationError)
        ),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }).catch(() => ({
          notifications: [],
        })),
      ]);
      setBookings(bookingRes.bookings);
      setConversations(conversationRes.conversations);
      setNotifications(notificationRes.notifications);

      if (isArtisanApplicantSession(user.firebaseUid)) {
        const offeringRes = await api<{ offerings: Offering[] }>('/offerings/me', { token: authToken }).catch(
          () => ({ offerings: [] })
        );
        setMyOfferings(offeringRes.offerings);
      } else {
        setMyOfferings([]);
      }
    }

    if (user.role === 'ARTISAN') {
      const [bookingRes, offeringRes, conversationRes, notificationRes] = await Promise.all([
        api<{ bookings: Booking[] }>('/bookings/artisan?page=1&limit=10', { token: authToken }).catch(() => ({
          bookings: [],
        })),
        api<{ offerings: Offering[] }>('/offerings/me', { token: authToken }).catch(() => ({ offerings: [] })),
        api<{ conversations: Conversation[] }>('/conversations', { token: authToken }).catch((err) =>
          conversationsFallback(err, notifyConversationError)
        ),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }).catch(() => ({
          notifications: [],
        })),
      ]);
      setBookings(bookingRes.bookings);
      setMyOfferings(offeringRes.offerings);
      setConversations(conversationRes.conversations);
      setNotifications(notificationRes.notifications);
    }

    if (user.role === 'ADMIN') {
      await loadAdminEssentials(authToken);
    }
  }, [loadAdminEssentials, notifyConversationError]);

  const clearPrivateData = useCallback(() => {
    setBookings([]);
    setConversations([]);
    setAdminConversations([]);
    setAdminBookings([]);
    setAdminBookingsTotal(0);
    setAdminKycSubmissions([]);
    setAdminUsers([]);
    setAdminArtisans([]);
    setAdminCategories([]);
    setNotifications([]);
    setMyOfferings([]);
    setAdminStats(null);
  }, []);

  const completePaymentReturn = useCallback(
    async (reference: string, authToken: string, user: ApiUser) => {
      const response = await api<VerifyPaymentResponse>('/payments/verify-reference', {
        method: 'POST',
        token: authToken,
        body: JSON.stringify({ reference }),
      });
      await loadPrivateData(authToken, user);
      return paymentSuccessFromVerify(response);
    },
    [loadPrivateData]
  );

  return {
    categories,
    artisans,
    publicOfferings,
    myOfferings,
    selectedArtisan,
    setSelectedArtisan,
    selectedArtisanReviews,
    setSelectedArtisanReviews,
    bookings,
    conversations,
    notifications,
    adminConversations,
    adminStats,
    adminBookings,
    adminBookingsTotal,
    adminKycSubmissions,
    adminUsers,
    adminArtisans,
    adminCategories,
    loadPublicData,
    loadPrivateData,
    loadConversations,
    loadAdminEssentials,
    loadAdminSection,
    clearPrivateData,
    completePaymentReturn,
  };
}
