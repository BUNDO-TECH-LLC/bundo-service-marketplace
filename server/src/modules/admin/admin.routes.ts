import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errorHandler';
import { httpError } from '../../utils/errors';
import { respondIfChatSchemaError } from '../../utils/handleChatSchemaError';
import { BookingStatus, KycStatus, Prisma, Role, UserStatus, VerifyStatus } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireRole } from '../../middlewares/requireRole';
import { getPagination, paginationMeta } from '../../utils/pagination';
import {
  releaseBookingPayment,
  resolveBookingDispute,
} from '../payments/payments.service';
import {
  countAdminArtisans,
  countAdminBookings,
  countAdminCategories,
  countAdminConversations,
  countAdminKycSubmissions,
  countAdminReviews,
  countUsers,
  createCategory,
  createAdminConversationMessage,
  createAdminConversationNote,
  deleteCategory,
  deleteReviewAndRecalculateRating,
  getAdminArtisanById,
  getAdminArtisans,
  getAdminBookingById,
  assignBookingModerator,
  getAdminBookings,
  updateAdminBookingStatus,
  getAdminCategories,
  getAdminConversationById,
  getAdminConversations,
  getAdminKycSubmissionById,
  getAdminKycSubmissions,
  getAdminReviews,
  getAdminLedgerEntries,
  countAdminLedgerEntries,
  getAdminStats,
  getUserById,
  getUsers,
  reviewKycSubmission,
  updateCategory,
  updateUserRole,
  updateUserStatus,
  verifyArtisan,
} from './admin.service';

const router = Router();

router.use(verifyFirebaseToken, requireRole(Role.ADMIN));

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const stats = await getAdminStats();

    res.json({
      message: 'Admin stats fetched',
      stats,
    });
  })
);

router.get('/users', asyncHandler(async (req, res) => {
  const pagination = getPagination(req, 50, 100);
  const [users, total] = await Promise.all([
    getUsers(pagination),
    countUsers(),
  ]);

  res.json({
    message: 'Users fetched',
    users,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
}));

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(String(req.params.id));

  if (!user) {
    throw httpError(404, 'User not found');
  }

  res.json({
    message: 'User fetched',
    user,
  });
}));

router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (![UserStatus.ACTIVE, UserStatus.BANNED].includes(status)) {
    throw httpError(400, 'status must be ACTIVE or BANNED');
  }

  try {
    const user = await updateUserStatus(String(req.params.id), status);

    res.json({
      message: 'User status updated',
      user,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw httpError(404, 'User not found');
    }

    throw error;
  }
}));

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (![Role.CUSTOMER, Role.ARTISAN, Role.ADMIN].includes(role)) {
    throw httpError(400, 'role must be CUSTOMER, ARTISAN, or ADMIN');
  }

  try {
    const user = await updateUserRole(String(req.params.id), role);

    res.json({
      message: 'User role updated',
      user,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw httpError(404, 'User not found');
    }

    throw error;
  }
}));

router.get('/artisans', asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const [artisans, total] = await Promise.all([
    getAdminArtisans(pagination),
    countAdminArtisans(),
  ]);

  res.json({
    message: 'Admin artisans fetched',
    artisans,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
}));

router.get('/artisans/:id', asyncHandler(async (req, res) => {
  const artisan = await getAdminArtisanById(String(req.params.id));

  if (!artisan) {
    throw httpError(404, 'Artisan not found');
  }

  res.json({
    message: 'Admin artisan fetched',
    artisan,
  });
}));

router.get('/kyc-submissions', asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const [submissions, total] = await Promise.all([
    getAdminKycSubmissions(pagination),
    countAdminKycSubmissions(),
  ]);

  res.json({
    message: 'Admin KYC submissions fetched',
    submissions,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
}));

router.get('/kyc-submissions/:id', asyncHandler(async (req, res) => {
  const submission = await getAdminKycSubmissionById(String(req.params.id));

  if (!submission) {
    throw httpError(404, 'KYC submission not found');
  }

  res.json({
    message: 'Admin KYC submission fetched',
    submission,
  });
}));

router.patch('/kyc-submissions/:id/review', asyncHandler(async (req, res) => {
  const { status, reviewNote } = req.body;

  if (
    ![KycStatus.APPROVED, KycStatus.REJECTED, KycStatus.CHANGES_REQUESTED].includes(
      status
    )
  ) {
    throw httpError(400, 'status must be APPROVED, REJECTED, or CHANGES_REQUESTED');
  }

  if (
    reviewNote !== undefined &&
    reviewNote !== null &&
    typeof reviewNote !== 'string'
  ) {
    throw httpError(400, 'reviewNote must be a string');
  }

  try {
    const submission = await reviewKycSubmission({
      id: String(req.params.id),
      status,
      reviewNote,
    });

    res.json({
      message: 'KYC submission reviewed',
      submission,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw httpError(404, 'KYC submission not found');
    }

    throw error;
  }
}));

router.patch('/artisans/:id/verify', asyncHandler(async (req, res) => {
  const { verifyStatus } = req.body;

  if (
    ![
      VerifyStatus.PENDING,
      VerifyStatus.APPROVED,
      VerifyStatus.REJECTED,
    ].includes(verifyStatus)
  ) {
    throw httpError(400, 'verifyStatus must be PENDING, APPROVED, or REJECTED');
  }

  try {
    const artisan = await verifyArtisan(String(req.params.id), verifyStatus);

    res.json({
      message: 'Artisan verification updated',
      artisan,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw httpError(404, 'Artisan not found');
    }

    throw error;
  }
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const [categories, total] = await Promise.all([
    getAdminCategories(pagination),
    countAdminCategories(),
  ]);

  res.json({
    message: 'Admin categories fetched',
    categories,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const { name, slug, iconKey } = req.body;

  if (!name || typeof name !== 'string') {
    throw httpError(400, 'name is required');
  }

  if (!slug || typeof slug !== 'string') {
    throw httpError(400, 'slug is required');
  }

  if (!iconKey || typeof iconKey !== 'string') {
    throw httpError(400, 'iconKey is required');
  }

  try {
    const category = await createCategory({ name, slug, iconKey });

    return res.status(201).json({
      message: 'Category created',
      category,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw httpError(409, 'Category name or slug already exists');
    }

    throw error;
  }
}));

router.patch('/categories/:id', asyncHandler(async (req, res) => {
  const { name, slug, iconKey } = req.body;
  const data: { name?: string; slug?: string; iconKey?: string } = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw httpError(400, 'name must be a string');
    }
    data.name = name;
  }

  if (slug !== undefined) {
    if (typeof slug !== 'string' || !slug.trim()) {
      throw httpError(400, 'slug must be a string');
    }
    data.slug = slug;
  }

  if (iconKey !== undefined) {
    if (typeof iconKey !== 'string' || !iconKey.trim()) {
      throw httpError(400, 'iconKey must be a string');
    }
    data.iconKey = iconKey;
  }

  if (!Object.keys(data).length) {
    throw httpError(400, 'No category fields provided');
  }

  try {
    const category = await updateCategory(String(req.params.id), data);

    res.json({
      message: 'Category updated',
      category,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw httpError(404, 'Category not found');
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw httpError(409, 'Category name or slug already exists');
    }

    throw error;
  }
}));

router.delete('/categories/:id', asyncHandler(async (req, res) => {
  const result = await deleteCategory(String(req.params.id));

  if (result.status === 'missing_category') {
    throw httpError(404, 'Category not found');
  }

  if (result.status === 'has_offerings') {
    throw httpError(409, 'Categories with offerings cannot be deleted');
  }

  res.json({ message: 'Category deleted' });
}));

router.get('/bookings', asyncHandler(async (req, res) => {
  const pagination = getPagination(req, 100, 200);
  const stageParam = typeof req.query.stage === 'string' ? req.query.stage : undefined;
  const allowedStages = ['requests', 'appointments', 'ongoing', 'completed'] as const;
  const stage = allowedStages.includes(stageParam as (typeof allowedStages)[number])
    ? (stageParam as (typeof allowedStages)[number])
    : undefined;

  if (stageParam && !stage) {
    throw httpError(400, 'stage must be requests, appointments, ongoing, or completed');
  }

  const moderatorParam =
    typeof req.query.moderatorId === 'string' ? req.query.moderatorId.trim() : undefined;
  const moderatorId = moderatorParam || undefined;

  const stageFilter = stage ? { stage } : {};
  const listFilter = {
    ...stageFilter,
    ...(moderatorId ? { moderatorId } : {}),
  };
  const [bookings, total] = await Promise.all([
    getAdminBookings(pagination, listFilter),
    countAdminBookings(listFilter),
  ]);

  res.json({
    message: 'Admin bookings fetched',
    bookings,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
}));

router.patch('/bookings/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowedStatuses = [
    BookingStatus.ACCEPTED,
    BookingStatus.ONGOING,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ];

  if (!allowedStatuses.includes(status)) {
    throw httpError(400, 'status must be ACCEPTED, ONGOING, COMPLETED, or CANCELLED');
  }

  const result = await updateAdminBookingStatus({
    bookingId: String(req.params.id),
    status,
    adminUserId: (req as any).user.firebaseUid,
  });

  if (result.status === 'missing_booking') {
    throw httpError(404, 'Booking not found');
  }

  if (result.status === 'invalid_transition') {
    throw httpError(
      409,
      `Cannot move booking from ${result.from} to ${status}`
    );
  }

  if (result.status === 'payment_required') {
    throw httpError(
      409,
      'Customer payment must be secured before the service can start or be marked completed'
    );
  }

  res.json({
    message: 'Booking status updated',
    booking: result.booking,
  });
}));

router.patch('/bookings/:id/moderator', asyncHandler(async (req, res) => {
  const moderatorId =
    req.body.moderatorId === null || req.body.moderatorId === ''
      ? null
      : String(req.body.moderatorId);

  if (
    req.body.moderatorId !== null &&
    req.body.moderatorId !== '' &&
    typeof req.body.moderatorId !== 'string'
  ) {
    throw httpError(400, 'moderatorId must be a string or null');
  }

  const result = await assignBookingModerator({
    bookingId: String(req.params.id),
    moderatorId,
  });

  if (result.status === 'missing_booking') {
    throw httpError(404, 'Booking not found');
  }

  if (result.status === 'invalid_moderator') {
    throw httpError(400, 'moderatorId must reference an active admin user');
  }

  res.json({
    message: moderatorId ? 'Job moderator assigned' : 'Job moderator cleared',
    booking: result.booking,
  });
}));

router.post('/bookings/:id/release-payment', asyncHandler(async (req, res) => {
  const result = await releaseBookingPayment(String(req.params.id));

  if (result.status === 'paystack_not_configured') {
    throw httpError(503, 'Paystack is not configured');
  }

  if (result.status === 'missing_booking') {
    throw httpError(404, 'Booking not found');
  }

  if (result.status === 'booking_not_completed') {
    throw httpError(409, 'Only completed bookings can be released');
  }

  if (result.status === 'payment_not_held') {
    throw httpError(409, 'Booking payment is not paid and held');
  }

  if (result.status === 'blocked_by_dispute') {
    throw httpError(409, 'Resolve the active dispute before releasing payout');
  }

  if (result.status === 'missing_payout_account') {
    throw httpError(409, 'Artisan payout account is missing or unverified');
  }

  if (result.status === 'already_released') {
    throw httpError(409, 'Payment has already been released');
  }

  res.json({
    message: 'Payment released to artisan',
    payment: result.payment,
    payout: result.payout,
  });
}));

router.post('/disputes/:id/resolve', asyncHandler(async (req, res) => {
  const { action, resolution, refundAmount } = req.body;

  if (!['RELEASE', 'REFUND_FULL', 'REFUND_PARTIAL'].includes(action)) {
    throw httpError(400, 'action must be RELEASE, REFUND_FULL, or REFUND_PARTIAL');
  }

  const parsedRefundAmount =
    refundAmount === undefined ? undefined : Number(refundAmount);
  const disputeAction = action as 'RELEASE' | 'REFUND_FULL' | 'REFUND_PARTIAL';

  const result = await resolveBookingDispute({
    disputeId: String(req.params.id),
    action: disputeAction,
    adminId: (req as any).user.firebaseUid,
    ...(typeof resolution === 'string' ? { resolution } : {}),
    ...(parsedRefundAmount !== undefined ? { refundAmount: parsedRefundAmount } : {}),
  });

  if (result.status === 'paystack_not_configured') {
    throw httpError(503, 'Paystack is not configured');
  }

  if (result.status === 'missing_dispute') {
    throw httpError(404, 'Dispute not found');
  }

  if (result.status === 'already_resolved') {
    throw httpError(409, 'Dispute is already resolved');
  }

  if (result.status === 'missing_payment') {
    throw httpError(404, 'Booking payment not found');
  }

  if (result.status === 'payment_not_held') {
    throw httpError(409, 'Only held payments can be resolved through dispute tools');
  }

  if (result.status === 'invalid_refund_amount') {
    throw httpError(400, 'refundAmount must be a positive number');
  }

  if (result.status === 'refund_too_large') {
    throw httpError(400, 'refundAmount cannot be greater than the original payment amount');
  }

  if (result.status === 'booking_not_completed') {
    throw httpError(409, 'Booking must be completed before payout release');
  }

  if (result.status === 'missing_payout_account') {
    throw httpError(409, 'Artisan payout account is missing or unverified');
  }

  if (result.status === 'blocked_by_dispute') {
    throw httpError(409, 'This dispute must be resolved directly, not via payout release');
  }

  if (result.status === 'already_released') {
    throw httpError(409, 'Payout has already been released');
  }

  if (result.status === 'resolved_release') {
    res.json({
      message: 'Dispute resolved and payout released',
      dispute: result.dispute,
      payment: result.payment,
      payout: result.payout,
    });
  }

  if (result.status === 'resolved_refund') {
    res.json({
      message: 'Dispute resolved with refund action',
      dispute: result.dispute,
      payment: result.payment,
      refundReference: result.refundReference,
    });
  }

  throw httpError(500, 'Unexpected dispute resolution outcome');
}));

router.get('/bookings/:id', asyncHandler(async (req, res) => {
  const booking = await getAdminBookingById(String(req.params.id));

  if (!booking) {
    throw httpError(404, 'Booking not found');
  }

  res.json({
    message: 'Admin booking fetched',
    booking,
  });
}));

router.get('/conversations', asyncHandler(async (req, res) => {
  try {
    const pagination = getPagination(req);
    const [conversations, total] = await Promise.all([
      getAdminConversations(pagination),
      countAdminConversations(),
    ]);

    res.json({
      message: 'Admin conversations fetched',
      conversations,
      meta: {
        ...paginationMeta(pagination),
        total,
      },
    });
  } catch (error: unknown) {
    if (respondIfChatSchemaError(error, res)) return;
    throw error;
  }
}));

router.get('/conversations/:id', asyncHandler(async (req, res) => {
  const conversation = await getAdminConversationById(String(req.params.id));

  if (!conversation) {
    throw httpError(404, 'Conversation not found');
  }

  res.json({
    message: 'Admin conversation fetched',
    conversation,
  });
}));

router.get('/conversations/:id/messages', asyncHandler(async (req, res) => {
  const conversation = await getAdminConversationById(String(req.params.id));

  if (!conversation) {
    throw httpError(404, 'Conversation not found');
  }

  res.json({
    message: 'Admin conversation messages fetched',
    conversation: {
      id: conversation.id,
      customerId: conversation.customerId,
      artisanId: conversation.artisanId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      customer: conversation.customer,
      artisan: conversation.artisan,
    },
    messages: conversation.messages,
  });
}));

router.post('/conversations/:id/notes', asyncHandler(async (req, res) => {
  const { body } = req.body;

  if (!body || typeof body !== 'string' || !body.trim()) {
    throw httpError(400, 'body is required');
  }

  const result = await createAdminConversationNote({
    conversationId: String(req.params.id),
    adminId: (req as any).user.firebaseUid,
    body,
  });

  if (result.status === 'missing_conversation') {
    throw httpError(404, 'Conversation not found');
  }

  throw httpError(201, 'Admin note created');
}));

router.post('/conversations/:id/messages', asyncHandler(async (req, res) => {
  const { body, imageUrl, imageCloudinaryId } = req.body;
  const hasBody = typeof body === 'string' && body.trim().length > 0;
  const hasImageUrl = typeof imageUrl === 'string' && imageUrl.trim().length > 0;

  if (body !== undefined && typeof body !== 'string') {
    throw httpError(400, 'body must be a string');
  }

  if (imageUrl !== undefined && !hasImageUrl) {
    throw httpError(400, 'imageUrl must be a non-empty string');
  }

  if (imageCloudinaryId !== undefined && typeof imageCloudinaryId !== 'string') {
    throw httpError(400, 'imageCloudinaryId must be a string');
  }

  if (!hasBody && !hasImageUrl) {
    throw httpError(400, 'body or imageUrl is required');
  }

  const result = await createAdminConversationMessage({
    conversationId: String(req.params.id),
    adminId: (req as any).user.firebaseUid,
    body: hasBody ? body : '',
    ...(hasImageUrl ? { imageUrl } : {}),
    ...(typeof imageCloudinaryId === 'string' && imageCloudinaryId
      ? { imageCloudinaryId }
      : {}),
  });

  if (result.status === 'missing_conversation') {
    throw httpError(404, 'Conversation not found');
  }

  throw httpError(201, 'Admin message sent');
}));

router.get('/reviews', asyncHandler(async (req, res) => {
  const pagination = getPagination(req);
  const [reviews, total] = await Promise.all([
    getAdminReviews(pagination),
    countAdminReviews(),
  ]);

  res.json({
    message: 'Admin reviews fetched',
    reviews,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
}));

router.get('/ledger-entries', asyncHandler(async (req, res) => {
  const pagination = getPagination(req, 50, 100);
  const [entries, total] = await Promise.all([
    getAdminLedgerEntries(pagination),
    countAdminLedgerEntries(),
  ]);

  res.json({
    message: 'Ledger entries fetched',
    entries,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
}));

router.delete('/reviews/:id', asyncHandler(async (req, res) => {
  const result = await deleteReviewAndRecalculateRating(String(req.params.id));

  if (result.status === 'missing_review') {
    throw httpError(404, 'Review not found');
  }

  res.json({
    message: 'Review deleted',
    artisan: result.artisan,
  });
}));

export default router;
