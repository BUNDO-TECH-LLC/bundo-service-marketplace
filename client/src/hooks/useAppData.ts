import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { paymentSuccessFromVerify, type VerifyPaymentResponse } from '../lib/paymentReturn';
import type {
  AdminArtisanRecord,
  AdminCategoryRecord,
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

export function useAppData(filters: MarketplaceFilterState) {
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
      const [categoryRes, artisanRes, offeringRes] = await Promise.all([
        api<{ categories: Category[] }>('/categories'),
        api<{ artisans: Artisan[] }>(`/artisans${query}`),
        api<{ offerings: Offering[] }>(`/offerings${query}`),
      ]);
      setCategories(categoryRes.categories);
      setArtisans(artisanRes.artisans);
      setPublicOfferings(offeringRes.offerings);
    },
    [filters]
  );

  const loadPrivateData = useCallback(async (authToken: string, user: ApiUser | null | undefined) => {
    if (!authToken || !user?.role) return;

    if (user.role === 'CUSTOMER') {
      const [bookingRes, conversationRes, notificationRes] = await Promise.all([
        api<{ bookings: Booking[] }>('/bookings/customer?page=1&limit=10', { token: authToken }),
        api<{ conversations: Conversation[] }>('/conversations', { token: authToken }),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }),
      ]);
      setBookings(bookingRes.bookings);
      setConversations(conversationRes.conversations);
      setNotifications(notificationRes.notifications);
      setMyOfferings([]);
    }

    if (user.role === 'ARTISAN') {
      const [bookingRes, offeringRes, conversationRes, notificationRes] = await Promise.all([
        api<{ bookings: Booking[] }>('/bookings/artisan?page=1&limit=10', { token: authToken }).catch(() => ({
          bookings: [],
        })),
        api<{ offerings: Offering[] }>('/offerings/me', { token: authToken }).catch(() => ({ offerings: [] })),
        api<{ conversations: Conversation[] }>('/conversations', { token: authToken }),
        api<{ notifications: Notification[] }>('/notifications', { token: authToken }),
      ]);
      setBookings(bookingRes.bookings);
      setMyOfferings(offeringRes.offerings);
      setConversations(conversationRes.conversations);
      setNotifications(notificationRes.notifications);
    }

    if (user.role === 'ADMIN') {
      const [stats, conversationRes, bookingRes, notificationRes, kycRes, userRes, artisanRes, categoryRes] =
        await Promise.all([
          api<{ stats: Record<string, number> }>('/admin/stats', { token: authToken }),
          api<{ conversations: Conversation[] }>('/admin/conversations?page=1&limit=20', { token: authToken }),
          api<{ bookings: Booking[]; meta: { total: number } }>('/admin/bookings?page=1&limit=200', {
            token: authToken,
          }),
          api<{ notifications: Notification[] }>('/notifications', { token: authToken }),
          api<{ submissions: ArtisanKycSubmission[] }>('/admin/kyc-submissions?page=1&limit=12', {
            token: authToken,
          }),
          api<{ users: AdminUserRecord[] }>('/admin/users?page=1&limit=100', { token: authToken }),
          api<{ artisans: AdminArtisanRecord[] }>('/admin/artisans?page=1&limit=24', { token: authToken }),
          api<{ categories: AdminCategoryRecord[] }>('/admin/categories?page=1&limit=24', { token: authToken }),
        ]);
      setAdminStats(stats.stats);
      setAdminConversations(conversationRes.conversations);
      setAdminBookings(bookingRes.bookings);
      setAdminBookingsTotal(bookingRes.meta?.total ?? bookingRes.bookings.length);
      setNotifications(notificationRes.notifications);
      setAdminKycSubmissions(kycRes.submissions);
      setAdminUsers(userRes.users);
      setAdminArtisans(artisanRes.artisans);
      setAdminCategories(categoryRes.categories);
    }
  }, []);

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
    clearPrivateData,
    completePaymentReturn,
  };
}
