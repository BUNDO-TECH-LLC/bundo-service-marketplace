import {
  BookingStatus,
  DisputeStatus,
  KycStatus,
  NotificationType,
  Prisma,
  Role,
  UserStatus,
  VerifyStatus,
} from '@prisma/client';
import db from '../../db/client';
import {
  appendBookingLifecycleMessage,
  attachConversationIdsToBookings,
} from '../../lib/bookingConversations';
import { bookingPaymentRequiredForStatus } from '../../lib/bookingPayment';
import {
  bookingStatusNotificationCopy,
  canTransitionBookingStatus,
} from '../../lib/bookingStatus';
import { Pagination, paginationArgs } from '../../utils/pagination';
import { workspaceBookingLink, workspaceLink } from '../../lib/appLinks';
import { createNotification } from '../notifications/notifications.service';
import { invalidateCachedAuthUser } from '../../middlewares/authSessionCache';
import { ConflictError, NotFoundError } from '../../utils/errors';
import {
  blocksLastActiveAdminRemoval,
  LAST_ADMIN_GUARD_MESSAGE,
} from './adminUserGuard';

export type AdminUserListFilters = {
  role?: Role;
  /** When true with role CUSTOMER, exclude accounts that have an artisan profile (pending applicants). */
  clientsOnly?: boolean;
};

type AdminStatsRow = {
  users: bigint;
  customers: bigint;
  client_accounts: bigint;
  artisans: bigint;
  admins: bigint;
  banned_users: bigint;
  pending_artisans: bigint;
  approved_artisans: bigint;
  pending_kyc_submissions: bigint;
  offerings: bigint;
  bookings: bigint;
  booking_requests: bigint;
  booking_appointments: bigint;
  booking_ongoing: bigint;
  booking_completed: bigint;
  payments: bigint;
  open_disputes: bigint;
  reviews: bigint;
  conversations: bigint;
};

let adminStatsCache: { stats: Record<string, number>; expiresAt: number } | null = null;
const ADMIN_STATS_CACHE_MS = 30_000;

export function clearAdminStatsCache() {
  adminStatsCache = null;
}

export const getAdminStats = async () => {
  if (adminStatsCache && Date.now() < adminStatsCache.expiresAt) {
    return adminStatsCache.stats;
  }

  const [row] = await db.$queryRaw<AdminStatsRow[]>`
    SELECT
      (SELECT COUNT(*)::bigint FROM users) AS users,
      (SELECT COUNT(*)::bigint FROM users WHERE role = ${Role.CUSTOMER}::"Role") AS customers,
      (SELECT COUNT(*)::bigint FROM users u
        WHERE u.role = ${Role.CUSTOMER}::"Role"
          AND NOT EXISTS (SELECT 1 FROM artisan_profiles ap WHERE ap.user_id = u.firebase_uid)
      ) AS client_accounts,
      (SELECT COUNT(*)::bigint FROM users WHERE role = ${Role.ARTISAN}::"Role") AS artisans,
      (SELECT COUNT(*)::bigint FROM users WHERE role = ${Role.ADMIN}::"Role") AS admins,
      (SELECT COUNT(*)::bigint FROM users WHERE status = ${UserStatus.BANNED}::"UserStatus") AS banned_users,
      (SELECT COUNT(*)::bigint FROM artisan_profiles WHERE verify_status = ${VerifyStatus.PENDING}::"VerifyStatus") AS pending_artisans,
      (SELECT COUNT(*)::bigint FROM artisan_profiles WHERE verify_status = ${VerifyStatus.APPROVED}::"VerifyStatus") AS approved_artisans,
      (SELECT COUNT(*)::bigint FROM artisan_kyc_submissions WHERE status = ${KycStatus.PENDING}::"KycStatus") AS pending_kyc_submissions,
      (SELECT COUNT(*)::bigint FROM offerings) AS offerings,
      (SELECT COUNT(*)::bigint FROM bookings) AS bookings,
      (SELECT COUNT(*)::bigint FROM bookings WHERE status = ${BookingStatus.REQUESTED}::"BookingStatus") AS booking_requests,
      (SELECT COUNT(*)::bigint FROM bookings WHERE status = ${BookingStatus.ACCEPTED}::"BookingStatus") AS booking_appointments,
      (SELECT COUNT(*)::bigint FROM bookings WHERE status = ${BookingStatus.ONGOING}::"BookingStatus") AS booking_ongoing,
      (SELECT COUNT(*)::bigint FROM bookings WHERE status = ${BookingStatus.COMPLETED}::"BookingStatus") AS booking_completed,
      (SELECT COUNT(*)::bigint FROM payments) AS payments,
      (SELECT COUNT(*)::bigint FROM disputes WHERE status IN (${DisputeStatus.OPEN}::"DisputeStatus", ${DisputeStatus.UNDER_REVIEW}::"DisputeStatus")) AS open_disputes,
      (SELECT COUNT(*)::bigint FROM reviews) AS reviews,
      (SELECT COUNT(*)::bigint FROM conversations) AS conversations
  `;

  if (!row) {
    throw new Error('Admin stats query returned no rows');
  }

  const stats = {
    users: Number(row.users),
    customers: Number(row.customers),
    clientAccounts: Number(row.client_accounts),
    artisans: Number(row.artisans),
    admins: Number(row.admins),
    bannedUsers: Number(row.banned_users),
    pendingArtisans: Number(row.pending_artisans),
    approvedArtisans: Number(row.approved_artisans),
    pendingKycSubmissions: Number(row.pending_kyc_submissions),
    offerings: Number(row.offerings),
    bookings: Number(row.bookings),
    bookingRequests: Number(row.booking_requests),
    bookingAppointments: Number(row.booking_appointments),
    bookingOngoing: Number(row.booking_ongoing),
    bookingCompleted: Number(row.booking_completed),
    payments: Number(row.payments),
    openDisputes: Number(row.open_disputes),
    reviews: Number(row.reviews),
    conversations: Number(row.conversations),
  };

  adminStatsCache = {
    stats,
    expiresAt: Date.now() + ADMIN_STATS_CACHE_MS,
  };

  return stats;
};

export const buildUserListWhere = (filters?: AdminUserListFilters) => {
  if (!filters?.role) {
    return undefined;
  }

  if (filters.clientsOnly && filters.role === Role.CUSTOMER) {
    return {
      role: Role.CUSTOMER,
      artisanProfile: { is: null },
    };
  }

  return { role: filters.role };
};

export const getUsers = async (
  pagination?: Pagination,
  filters?: AdminUserListFilters
) => {
  const where = buildUserListWhere(filters);
  return db.user.findMany({
    ...(where ? { where } : {}),
    orderBy: { createdAt: 'desc' },
    ...paginationArgs(pagination),
    include: {
      artisanProfile: {
        select: {
          id: true,
          displayName: true,
          verifyStatus: true,
        },
      },
    },
  });
};

export const countUsers = async (filters?: AdminUserListFilters) => {
  const where = buildUserListWhere(filters);
  return db.user.count({
    ...(where ? { where } : {}),
  });
};

export const getUserById = async (firebaseUid: string) => {
  return db.user.findUnique({
    where: { firebaseUid },
    include: {
      artisanProfile: true,
      bookingsAsCustomer: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      reviewsWritten: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
};

const countActiveAdmins = () =>
  db.user.count({
    where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
  });

export const updateUserStatus = async (
  firebaseUid: string,
  status: UserStatus
) => {
  const existing = await db.user.findUnique({ where: { firebaseUid } });

  if (!existing) {
    throw new NotFoundError('User');
  }

  if (existing.status === status) {
    return existing;
  }

  if (
    blocksLastActiveAdminRemoval({
      currentRole: existing.role ?? Role.CUSTOMER,
      currentStatus: existing.status,
      nextStatus: status,
      activeAdminCount: await countActiveAdmins(),
    })
  ) {
    throw new ConflictError(LAST_ADMIN_GUARD_MESSAGE, 'LAST_ADMIN');
  }

  const user = await db.user.update({
    where: { firebaseUid },
    data: { status },
  });
  invalidateCachedAuthUser(firebaseUid);
  clearAdminStatsCache();
  return user;
};

export const updateUserRole = async (firebaseUid: string, role: Role) => {
  const existing = await db.user.findUnique({ where: { firebaseUid } });

  if (!existing) {
    throw new NotFoundError('User');
  }

  if (existing.role === role) {
    return existing;
  }

  if (
    blocksLastActiveAdminRemoval({
      currentRole: existing.role ?? Role.CUSTOMER,
      currentStatus: existing.status,
      nextRole: role,
      activeAdminCount: await countActiveAdmins(),
    })
  ) {
    throw new ConflictError(LAST_ADMIN_GUARD_MESSAGE, 'LAST_ADMIN');
  }

  const user = await db.user.update({
    where: { firebaseUid },
    data: { role },
  });
  invalidateCachedAuthUser(firebaseUid);
  clearAdminStatsCache();
  return user;
};

export const getAdminArtisans = async (
  pagination?: Pagination,
  filters?: { verifyStatus?: VerifyStatus }
) => {
  const where = filters?.verifyStatus ? { verifyStatus: filters.verifyStatus } : undefined;
  return db.artisanProfile.findMany({
    ...(where ? { where } : {}),
    orderBy: { createdAt: 'desc' },
    ...paginationArgs(pagination),
    include: {
      user: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
          role: true,
          status: true,
        },
      },
      portfolioImages: {
        orderBy: { displayOrder: 'asc' },
        take: 12,
      },
      _count: {
        select: {
          offerings: true,
          bookingsReceived: true,
          reviewsReceived: true,
          portfolioImages: true,
        },
      },
    },
  });
};

export const countAdminArtisans = async (filters?: { verifyStatus?: VerifyStatus }) => {
  const where = filters?.verifyStatus ? { verifyStatus: filters.verifyStatus } : undefined;
  return db.artisanProfile.count({
    ...(where ? { where } : {}),
  });
};

export const getAdminArtisanById = async (id: string) => {
  return db.artisanProfile.findUnique({
    where: { id },
    include: {
      user: true,
      kycSubmission: true,
      offerings: {
        include: { category: true },
      },
      portfolioImages: true,
      availabilitySlots: true,
      reviewsReceived: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
};

export const getAdminKycSubmissions = async (pagination?: Pagination) => {
  return db.artisanKycSubmission.findMany({
    orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
    ...paginationArgs(pagination, 50),
    include: {
      artisan: {
        include: {
          user: {
            select: {
              firebaseUid: true,
              email: true,
              phone: true,
              role: true,
              status: true,
            },
          },
          portfolioImages: {
            orderBy: { displayOrder: 'asc' },
            take: 12,
          },
        },
      },
    },
  });
};

export const countAdminKycSubmissions = async () => {
  return db.artisanKycSubmission.count();
};

export const getAdminKycSubmissionById = async (id: string) => {
  return db.artisanKycSubmission.findUnique({
    where: { id },
    include: {
      artisan: {
        include: {
          user: {
            select: {
              firebaseUid: true,
              email: true,
              phone: true,
              role: true,
              status: true,
            },
          },
          offerings: {
            include: { category: true },
          },
        },
      },
    },
  });
};

export const reviewKycSubmission = async (input: {
  id: string;
  status: KycStatus;
  reviewNote?: string | null;
}) => {
  const verifyStatus =
    input.status === KycStatus.APPROVED
      ? VerifyStatus.APPROVED
      : input.status === KycStatus.REJECTED
        ? VerifyStatus.REJECTED
        : VerifyStatus.PENDING;

  const submission = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const reviewedSubmission = await tx.artisanKycSubmission.update({
      where: { id: input.id },
      data: {
        status: input.status,
        reviewNote: input.reviewNote ?? null,
        reviewedAt: new Date(),
      },
      include: {
        artisan: true,
      },
    });

    const artisan = await tx.artisanProfile.update({
      where: { id: reviewedSubmission.artisanId },
      data: {
        verifyStatus,
        verifiedAt: verifyStatus === VerifyStatus.APPROVED ? new Date() : null,
      },
    });

    if (input.status === KycStatus.APPROVED) {
      await tx.user.update({
        where: { firebaseUid: artisan.userId },
        data: { role: Role.ARTISAN, onboardingIntent: null },
      });
    }

    return { ...reviewedSubmission, artisan };
  });

  invalidateCachedAuthUser(submission.artisan.userId);
  clearAdminStatsCache();

  await createNotification({
    userId: submission.artisan.userId,
    type: NotificationType.ADMIN,
    title:
      input.status === KycStatus.APPROVED
        ? 'KYC approved'
        : input.status === KycStatus.REJECTED
          ? 'KYC rejected'
          : 'KYC needs changes',
    body:
      input.status === KycStatus.APPROVED
        ? 'Your KYC submission has been approved.'
        : input.status === KycStatus.REJECTED
          ? 'Your KYC submission was rejected. Review the admin note and resubmit.'
          : 'Your KYC submission needs changes before approval.',
    link: workspaceLink('overview'),
  });

  return submission;
};

export const verifyArtisan = async (
  id: string,
  verifyStatus: VerifyStatus
) => {
  if (verifyStatus === VerifyStatus.APPROVED) {
    const artisan = await db.artisanProfile.findUnique({
      where: { id },
      include: {
        kycSubmission: {
          select: { status: true },
        },
      },
    });

    if (!artisan) {
      throw new NotFoundError('Artisan');
    }

    if (artisan.kycSubmission?.status !== KycStatus.APPROVED) {
      throw new ConflictError(
        'Approve identity verification (KYC) before approving this artisan for the marketplace.',
        'KYC_REQUIRED'
      );
    }
  }

  const artisan = await db.artisanProfile.update({
    where: { id },
    data: {
      verifyStatus,
      verifiedAt: verifyStatus === VerifyStatus.APPROVED ? new Date() : null,
    },
  });

  await createNotification({
    userId: artisan.userId,
    type: NotificationType.ADMIN,
    title:
      verifyStatus === VerifyStatus.APPROVED
        ? 'Artisan profile approved'
        : verifyStatus === VerifyStatus.REJECTED
          ? 'Artisan profile rejected'
          : 'Artisan review updated',
    body:
      verifyStatus === VerifyStatus.APPROVED
        ? 'Your artisan profile is now approved and discoverable.'
        : verifyStatus === VerifyStatus.REJECTED
          ? 'Your artisan profile review was rejected. Please review your submission details.'
          : 'Your artisan verification status was updated.',
    link: workspaceLink('overview'),
  });

  return artisan;
};

export const getAdminCategories = async (pagination?: Pagination) => {
  return db.category.findMany({
    orderBy: { name: 'asc' },
    ...paginationArgs(pagination),
    include: {
      _count: {
        select: { offerings: true },
      },
    },
  });
};

export const countAdminCategories = async () => {
  return db.category.count();
};

export const createCategory = async (input: {
  name: string;
  slug: string;
  iconKey: string;
}) => {
  return db.category.create({
    data: input,
  });
};

export const updateCategory = async (
  id: string,
  input: { name?: string; slug?: string; iconKey?: string }
) => {
  return db.category.update({
    where: { id },
    data: input,
  });
};

export const deleteCategory = async (id: string) => {
  const category = await db.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { offerings: true },
      },
    },
  });

  if (!category) {
    return { status: 'missing_category' as const };
  }

  if (category._count.offerings > 0) {
    return { status: 'has_offerings' as const };
  }

  await db.category.delete({
    where: { id },
  });

  return { status: 'deleted' as const };
};

export type AdminBookingStage =
  | 'requests'
  | 'appointments'
  | 'ongoing'
  | 'completed';

const bookingAdminInclude = {
  customerUser: {
    select: {
      firebaseUid: true,
      email: true,
      phone: true,
      status: true,
    },
  },
  moderator: {
    select: {
      firebaseUid: true,
      email: true,
      phone: true,
    },
  },
  artisan: {
    select: {
      id: true,
      userId: true,
      displayName: true,
      city: true,
      area: true,
      verifyStatus: true,
    },
  },
  offering: {
    select: {
      id: true,
      title: true,
      priceFrom: true,
      priceTo: true,
      category: true,
    },
  },
  payment: true,
  payouts: true,
  disputes: true,
} satisfies Prisma.BookingInclude;

function adminBookingStageWhere(stage?: AdminBookingStage) {
  switch (stage) {
    case 'requests':
      return { status: BookingStatus.REQUESTED };
    case 'appointments':
      return { status: BookingStatus.ACCEPTED };
    case 'ongoing':
      return { status: BookingStatus.ONGOING };
    case 'completed':
      return { status: BookingStatus.COMPLETED };
    default:
      return undefined;
  }
}

function adminBookingModeratorWhere(
  moderatorId?: string
): Prisma.BookingWhereInput | undefined {
  if (!moderatorId) {
    return undefined;
  }

  if (moderatorId === 'unassigned') {
    return { moderatorId: null };
  }

  return { moderatorId };
}

export const getAdminBookings = async (
  pagination?: Pagination,
  options?: { stage?: AdminBookingStage; moderatorId?: string }
) => {
  const stageWhere = adminBookingStageWhere(options?.stage);
  const moderatorWhere = adminBookingModeratorWhere(options?.moderatorId);
  const where: Prisma.BookingWhereInput = {
    ...(stageWhere ?? {}),
    ...(moderatorWhere ?? {}),
  };
  const bookings = await db.booking.findMany({
    ...(Object.keys(where).length ? { where } : {}),
    orderBy: { createdAt: 'desc' },
    ...paginationArgs(pagination, 100),
    include: bookingAdminInclude,
  });

  return attachConversationIdsToBookings(bookings);
};

export const updateAdminBookingStatus = async (input: {
  bookingId: string;
  status: BookingStatus;
  adminUserId: string;
}) => {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      offering: true,
      artisan: true,
      payment: true,
    },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  if (!canTransitionBookingStatus(booking.status, input.status, 'admin')) {
    return { status: 'invalid_transition' as const, from: booking.status };
  }

  if (bookingPaymentRequiredForStatus(booking.payment, input.status)) {
    return { status: 'payment_required' as const };
  }

  if (
    input.status === BookingStatus.ACCEPTED ||
    input.status === BookingStatus.ONGOING ||
    input.status === BookingStatus.COMPLETED
  ) {
    await appendBookingLifecycleMessage({
      customerId: booking.customerId,
      artisanId: booking.artisanId,
      senderId: input.adminUserId,
      status: input.status,
    });
  }

  const updated = await db.booking.update({
    where: { id: input.bookingId },
    data: { status: input.status },
    include: bookingAdminInclude,
  });

  const [withConversation] = await attachConversationIdsToBookings([updated]);

  const statusCopy: Partial<Record<BookingStatus, { title: string; body: string }>> = {
    [BookingStatus.ONGOING]: {
      title: 'Service in progress',
      body: `Your booking for ${updated.offering?.title || 'a service'} is now in progress.`,
    },
    [BookingStatus.COMPLETED]: {
      title: 'Booking completed',
      body: `Your booking for ${updated.offering?.title || 'a service'} was marked completed.`,
    },
    [BookingStatus.CANCELLED]: {
      title: 'Booking cancelled',
      body: `Your booking for ${updated.offering?.title || 'a service'} was cancelled by support.`,
    },
  };

  const copy = statusCopy[input.status];

  if (copy) {
    const recipients = [updated.customerId];
    if (updated.artisan?.userId) {
      recipients.push(updated.artisan.userId);
    }

    await Promise.all(
      recipients.map((userId) =>
        createNotification({
          userId,
          type: NotificationType.BOOKING,
          title: copy.title,
          body: copy.body,
          link: workspaceBookingLink(updated.id),
        })
      )
    );
  }

  return { status: 'updated' as const, booking: withConversation };
};

export const countAdminBookings = async (options?: {
  stage?: AdminBookingStage;
  moderatorId?: string;
}) => {
  const stageWhere = adminBookingStageWhere(options?.stage);
  const moderatorWhere = adminBookingModeratorWhere(options?.moderatorId);
  const where: Prisma.BookingWhereInput = {
    ...(stageWhere ?? {}),
    ...(moderatorWhere ?? {}),
  };
  return db.booking.count({
    ...(Object.keys(where).length ? { where } : {}),
  });
};

export const getAdminLedgerEntries = async (pagination?: Pagination) => {
  return db.ledgerEntry.findMany({
    orderBy: { createdAt: 'desc' },
    ...paginationArgs(pagination, 50),
    include: {
      booking: {
        select: {
          id: true,
          offering: { select: { title: true } },
        },
      },
      payment: {
        select: {
          status: true,
          paystackReference: true,
        },
      },
    },
  });
};

export const countAdminLedgerEntries = async () => {
  return db.ledgerEntry.count();
};

export const assignBookingModerator = async (input: {
  bookingId: string;
  moderatorId: string | null;
}) => {
  if (input.moderatorId) {
    const moderator = await db.user.findFirst({
      where: {
        firebaseUid: input.moderatorId,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    if (!moderator) {
      return { status: 'invalid_moderator' as const };
    }
  }

  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  const updated = await db.booking.update({
    where: { id: input.bookingId },
    data: { moderatorId: input.moderatorId },
    include: bookingAdminInclude,
  });

  const [withConversation] = await attachConversationIdsToBookings([updated]);
  return { status: 'updated' as const, booking: withConversation };
};

export const getAdminBookingById = async (id: string) => {
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      customerUser: true,
      moderator: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
        },
      },
      artisan: true,
      offering: {
        include: { category: true },
      },
      review: true,
      payment: true,
      payouts: true,
      disputes: true,
      ledgerEntries: true,
    },
  });

  if (!booking) {
    return null;
  }

  const [withConversation] = await attachConversationIdsToBookings([booking]);
  return withConversation;
};

export const getAdminReviews = async (pagination?: Pagination) => {
  return db.review.findMany({
    orderBy: { createdAt: 'desc' },
    ...paginationArgs(pagination, 50),
    include: {
      customer: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      artisan: {
        select: {
          id: true,
          displayName: true,
          avgRating: true,
          ratingCount: true,
        },
      },
      booking: {
        include: {
          offering: {
            include: { category: true },
          },
        },
      },
    },
  });
};

export const countAdminReviews = async () => {
  return db.review.count();
};

export const deleteReviewAndRecalculateRating = async (id: string) => {
  const review = await db.review.findUnique({
    where: { id },
  });

  if (!review) {
    return { status: 'missing_review' as const };
  }

  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.review.delete({
      where: { id },
    });

    const aggregate = await tx.review.aggregate({
      where: { artisanId: review.artisanId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const artisan = await tx.artisanProfile.update({
      where: { id: review.artisanId },
      data: {
        avgRating: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      },
    });

    return artisan;
  });

  return { status: 'deleted' as const, artisan: result };
};

export const getAdminConversations = async (pagination?: Pagination) => {
  return db.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    ...paginationArgs(pagination, 50),
    include: {
      customer: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
          role: true,
          status: true,
        },
      },
      artisan: {
        select: {
          id: true,
          displayName: true,
          city: true,
          area: true,
          verifyStatus: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: {
            select: {
              firebaseUid: true,
              email: true,
              role: true,
            },
          },
        },
      },
      adminNotes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          admin: {
            select: {
              firebaseUid: true,
              email: true,
            },
          },
        },
      },
    },
  });
};

export const countAdminConversations = async () => {
  return db.conversation.count();
};

export const getAdminConversationById = async (id: string) => {
  return db.conversation.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          firebaseUid: true,
          email: true,
          phone: true,
          role: true,
          status: true,
        },
      },
      artisan: {
        include: {
          user: {
            select: {
              firebaseUid: true,
              email: true,
              phone: true,
              status: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: {
              firebaseUid: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      },
      adminNotes: {
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              firebaseUid: true,
              email: true,
            },
          },
        },
      },
    },
  });
};

export const createAdminConversationNote = async (input: {
  conversationId: string;
  adminId: string;
  body: string;
}) => {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
    select: { id: true },
  });

  if (!conversation) {
    return { status: 'missing_conversation' as const };
  }

  const note = await db.adminNote.create({
    data: {
      conversationId: input.conversationId,
      adminId: input.adminId,
      body: input.body.trim(),
    },
    include: {
      admin: {
        select: {
          firebaseUid: true,
          email: true,
        },
      },
    },
  });

  return { status: 'created' as const, note };
};

export const createAdminConversationMessage = async (input: {
  conversationId: string;
  adminId: string;
  body: string;
  imageUrl?: string;
  imageCloudinaryId?: string;
}) => {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      artisan: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!conversation) {
    return { status: 'missing_conversation' as const };
  }

  const message = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdMessage = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.adminId,
        body: input.body.trim(),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.imageCloudinaryId !== undefined
          ? { imageCloudinaryId: input.imageCloudinaryId }
          : {}),
      },
      include: {
        sender: {
          select: {
            firebaseUid: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    await tx.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    return createdMessage;
  });

  const recipients = [conversation.customerId, conversation.artisan?.userId].filter(
    (userId): userId is string => Boolean(userId)
  );

  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: NotificationType.ADMIN,
        title: 'Admin joined your conversation',
        body: 'Bundo support replied in your service chat.',
        link: workspaceLink('messages'),
      })
    )
  );

  return { status: 'created' as const, message };
};
