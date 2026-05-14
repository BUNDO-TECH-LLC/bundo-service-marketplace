import {
  DisputeStatus,
  KycStatus,
  NotificationType,
  Prisma,
  Role,
  UserStatus,
  VerifyStatus,
} from '@prisma/client';
import db from '../../db/client';
import { Pagination, paginationArgs } from '../../utils/pagination';
import { createNotification } from '../notifications/notifications.service';

export const getAdminStats = async () => {
  const [
    users,
    customers,
    artisans,
    admins,
    bannedUsers,
    pendingArtisans,
    approvedArtisans,
    pendingKycSubmissions,
    offerings,
    bookings,
    payments,
    openDisputes,
    reviews,
    conversations,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: Role.CUSTOMER } }),
    db.user.count({ where: { role: Role.ARTISAN } }),
    db.user.count({ where: { role: Role.ADMIN } }),
    db.user.count({ where: { status: UserStatus.BANNED } }),
    db.artisanProfile.count({ where: { verifyStatus: VerifyStatus.PENDING } }),
    db.artisanProfile.count({ where: { verifyStatus: VerifyStatus.APPROVED } }),
    db.artisanKycSubmission.count({ where: { status: KycStatus.PENDING } }),
    db.offering.count(),
    db.booking.count(),
    db.payment.count(),
    db.dispute.count({
      where: {
        status: {
          in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
        },
      },
    }),
    db.review.count(),
    db.conversation.count(),
  ]);

  return {
    users,
    customers,
    artisans,
    admins,
    bannedUsers,
    pendingArtisans,
    approvedArtisans,
    pendingKycSubmissions,
    offerings,
    bookings,
    payments,
    openDisputes,
    reviews,
    conversations,
  };
};

export const getUsers = async (pagination?: Pagination) => {
  return db.user.findMany({
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

export const countUsers = async () => {
  return db.user.count();
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

export const updateUserStatus = async (
  firebaseUid: string,
  status: UserStatus
) => {
  return db.user.update({
    where: { firebaseUid },
    data: { status },
  });
};

export const updateUserRole = async (firebaseUid: string, role: Role) => {
  return db.user.update({
    where: { firebaseUid },
    data: { role },
  });
};

export const getAdminArtisans = async (pagination?: Pagination) => {
  return db.artisanProfile.findMany({
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
      _count: {
        select: {
          offerings: true,
          bookingsReceived: true,
          reviewsReceived: true,
        },
      },
    },
  });
};

export const countAdminArtisans = async () => {
  return db.artisanProfile.count();
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

    return { ...reviewedSubmission, artisan };
  });

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
    link: '/?view=workspace&section=overview',
  });

  return submission;
};

export const verifyArtisan = async (
  id: string,
  verifyStatus: VerifyStatus
) => {
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
    link: '/?view=workspace&section=overview',
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

export const getAdminBookings = async (pagination?: Pagination) => {
  return db.booking.findMany({
    orderBy: { createdAt: 'desc' },
    ...paginationArgs(pagination, 50),
    include: {
      customerUser: {
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
    },
  });
};

export const countAdminBookings = async () => {
  return db.booking.count();
};

export const getAdminBookingById = async (id: string) => {
  return db.booking.findUnique({
    where: { id },
    include: {
      customerUser: true,
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
        link: '/?view=workspace&section=messages',
      })
    )
  );

  return { status: 'created' as const, message };
};
