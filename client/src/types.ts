export type Role = 'CUSTOMER' | 'ARTISAN' | 'ADMIN';
export type VerifyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type KycStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED';
export type PaymentStatus =
  | 'UNPAID'
  | 'PAYMENT_PENDING'
  | 'PAID_HELD'
  | 'REFUND_REQUESTED'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'FAILED';
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED_REFUND'
  | 'RESOLVED_RELEASE'
  | 'RESOLVED_PARTIAL'
  | 'CLOSED';
export type NotificationType =
  | 'BOOKING'
  | 'PAYMENT'
  | 'DISPUTE'
  | 'MESSAGE'
  | 'REVIEW'
  | 'ADMIN';

export type NotificationPreferences = {
  bookings: boolean;
  messages: boolean;
  marketing: boolean;
};

export type ApiUser = {
  firebaseUid: string;
  email: string | null;
  phone: string | null;
  role: Role | null;
  status: 'ACTIVE' | 'BANNED';
  state?: string | null;
  area?: string | null;
  address?: string | null;
  profileCompletedAt?: string | null;
  profileComplete?: boolean;
  onboardingIntent?: 'ARTISAN' | null;
  notificationPreferences?: NotificationPreferences;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  iconKey: string;
};

export type Artisan = {
  id: string;
  userId?: string;
  displayName: string;
  bio: string | null;
  city: string;
  area: string | null;
  lat: number;
  lng: number;
  avgRating: number;
  ratingCount: number;
  verifyStatus: VerifyStatus;
  kycSubmission?: ArtisanKycSubmission | null;
  offerings?: Offering[];
  portfolioImages?: PortfolioImage[];
  availabilitySlots?: AvailabilitySlot[];
  createdAt?: string;
};

export type Offering = {
  id: string;
  artisanId: string;
  categoryId: string;
  title: string;
  description: string | null;
  priceFrom: number;
  priceTo: number | null;
  category?: Category;
  artisan?: Artisan;
};

export type Booking = {
  id: string;
  customerId?: string;
  artisanId?: string;
  offeringId?: string;
  moderatorId?: string | null;
  status: 'REQUESTED' | 'ACCEPTED' | 'ONGOING' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
  conversationId?: string | null;
  note: string | null;
  agreedAmount?: number | null;
  scheduledAt: string | null;
  customerUser?: Pick<ApiUser, 'firebaseUid' | 'email' | 'phone'>;
  moderator?: Pick<ApiUser, 'firebaseUid' | 'email' | 'phone'> | null;
  offering?: Offering;
  artisan?: Artisan;
  payment?: Payment | null;
  payouts?: Payout[];
  disputes?: Dispute[];
  review?: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  } | null;
};

export type Payment = {
  id: string;
  bookingId: string;
  customerId: string;
  artisanId: string;
  amount: number;
  platformFee: number;
  providerEarning: number;
  releasedAmount?: number;
  currency: string;
  status: PaymentStatus;
  authorizationUrl?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProviderPayoutAccount = {
  id: string;
  artisanId: string;
  bankCode: string;
  bankName: string | null;
  accountNumber: string;
  accountName: string | null;
  isVerified: boolean;
};

export type PayoutBank = {
  name: string;
  code: string;
};

export type Payout = {
  id: string;
  bookingId: string;
  paymentId: string;
  artisanId: string;
  amount: number;
  status: PayoutStatus;
  paystackTransferCode?: string | null;
  paystackReference?: string | null;
  sentAt?: string | null;
};

export type Dispute = {
  id: string;
  bookingId: string;
  raisedById: string;
  reason: string;
  status: DisputeStatus;
  resolution?: string | null;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ArtisanKycSubmission = {
  id: string;
  artisanId: string;
  status: KycStatus;
  legalName: string;
  documentType: string;
  documentNumber: string;
  documentImageUrl: string;
  selfieImageUrl: string | null;
  address: string;
  city: string;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  artisan?: Artisan & {
    user?: Pick<ApiUser, 'firebaseUid' | 'email' | 'phone' | 'role' | 'status'>;
  };
};

export type Conversation = {
  id: string;
  customerId: string;
  artisanId: string;
  customer?: Pick<ApiUser, 'firebaseUid' | 'email' | 'phone' | 'role' | 'status'>;
  artisan?: Artisan;
  messages?: Message[];
  adminNotes?: AdminNote[];
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  imageUrl?: string | null;
  imageCloudinaryId?: string | null;
  readAt?: string | null;
  createdAt: string;
  sender?: Pick<ApiUser, 'firebaseUid' | 'email' | 'phone' | 'role'>;
};

export type AdminNote = {
  id: string;
  conversationId: string;
  adminId: string;
  body: string;
  createdAt: string;
  admin?: Pick<ApiUser, 'firebaseUid' | 'email'>;
};

export type PortfolioImage = {
  id: string;
  artisanId: string;
  cloudinaryId?: string;
  url: string;
  displayOrder: number;
  createdAt: string;
};

export type AvailabilitySlot = {
  id: string;
  artisanId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export type CloudinarySignedUpload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

export type Review = {
  id: string;
  bookingId: string;
  customerId: string;
  artisanId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customer?: Pick<ApiUser, 'firebaseUid' | 'email' | 'phone'>;
  booking?: {
    id: string;
    offering?: Pick<Offering, 'id' | 'title'> & { category?: Category };
  };
};
