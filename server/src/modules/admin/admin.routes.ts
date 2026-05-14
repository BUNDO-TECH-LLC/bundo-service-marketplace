import { Router } from 'express';
import { KycStatus, Prisma, Role, UserStatus, VerifyStatus } from '@prisma/client';
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
  getAdminBookings,
  getAdminCategories,
  getAdminConversationById,
  getAdminConversations,
  getAdminKycSubmissionById,
  getAdminKycSubmissions,
  getAdminReviews,
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

router.get('/stats', async (_req, res) => {
  const stats = await getAdminStats();

  return res.json({
    message: 'Admin stats fetched',
    stats,
  });
});

router.get('/users', async (req, res) => {
  const pagination = getPagination(req);
  const [users, total] = await Promise.all([
    getUsers(pagination),
    countUsers(),
  ]);

  return res.json({
    message: 'Users fetched',
    users,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.get('/users/:id', async (req, res) => {
  const user = await getUserById(String(req.params.id));

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({
    message: 'User fetched',
    user,
  });
});

router.patch('/users/:id/status', async (req, res) => {
  const { status } = req.body;

  if (![UserStatus.ACTIVE, UserStatus.BANNED].includes(status)) {
    return res.status(400).json({
      message: 'status must be ACTIVE or BANNED',
    });
  }

  try {
    const user = await updateUserStatus(String(req.params.id), status);

    return res.json({
      message: 'User status updated',
      user,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return res.status(404).json({ message: 'User not found' });
    }

    throw error;
  }
});

router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;

  if (![Role.CUSTOMER, Role.ARTISAN, Role.ADMIN].includes(role)) {
    return res.status(400).json({
      message: 'role must be CUSTOMER, ARTISAN, or ADMIN',
    });
  }

  try {
    const user = await updateUserRole(String(req.params.id), role);

    return res.json({
      message: 'User role updated',
      user,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return res.status(404).json({ message: 'User not found' });
    }

    throw error;
  }
});

router.get('/artisans', async (req, res) => {
  const pagination = getPagination(req);
  const [artisans, total] = await Promise.all([
    getAdminArtisans(pagination),
    countAdminArtisans(),
  ]);

  return res.json({
    message: 'Admin artisans fetched',
    artisans,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.get('/artisans/:id', async (req, res) => {
  const artisan = await getAdminArtisanById(String(req.params.id));

  if (!artisan) {
    return res.status(404).json({ message: 'Artisan not found' });
  }

  return res.json({
    message: 'Admin artisan fetched',
    artisan,
  });
});

router.get('/kyc-submissions', async (req, res) => {
  const pagination = getPagination(req);
  const [submissions, total] = await Promise.all([
    getAdminKycSubmissions(pagination),
    countAdminKycSubmissions(),
  ]);

  return res.json({
    message: 'Admin KYC submissions fetched',
    submissions,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.get('/kyc-submissions/:id', async (req, res) => {
  const submission = await getAdminKycSubmissionById(String(req.params.id));

  if (!submission) {
    return res.status(404).json({ message: 'KYC submission not found' });
  }

  return res.json({
    message: 'Admin KYC submission fetched',
    submission,
  });
});

router.patch('/kyc-submissions/:id/review', async (req, res) => {
  const { status, reviewNote } = req.body;

  if (
    ![KycStatus.APPROVED, KycStatus.REJECTED, KycStatus.CHANGES_REQUESTED].includes(
      status
    )
  ) {
    return res.status(400).json({
      message: 'status must be APPROVED, REJECTED, or CHANGES_REQUESTED',
    });
  }

  if (
    reviewNote !== undefined &&
    reviewNote !== null &&
    typeof reviewNote !== 'string'
  ) {
    return res.status(400).json({ message: 'reviewNote must be a string' });
  }

  try {
    const submission = await reviewKycSubmission({
      id: String(req.params.id),
      status,
      reviewNote,
    });

    return res.json({
      message: 'KYC submission reviewed',
      submission,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return res.status(404).json({ message: 'KYC submission not found' });
    }

    throw error;
  }
});

router.patch('/artisans/:id/verify', async (req, res) => {
  const { verifyStatus } = req.body;

  if (
    ![
      VerifyStatus.PENDING,
      VerifyStatus.APPROVED,
      VerifyStatus.REJECTED,
    ].includes(verifyStatus)
  ) {
    return res.status(400).json({
      message: 'verifyStatus must be PENDING, APPROVED, or REJECTED',
    });
  }

  try {
    const artisan = await verifyArtisan(String(req.params.id), verifyStatus);

    return res.json({
      message: 'Artisan verification updated',
      artisan,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    throw error;
  }
});

router.get('/categories', async (req, res) => {
  const pagination = getPagination(req);
  const [categories, total] = await Promise.all([
    getAdminCategories(pagination),
    countAdminCategories(),
  ]);

  return res.json({
    message: 'Admin categories fetched',
    categories,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.post('/categories', async (req, res) => {
  const { name, slug, iconKey } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'name is required' });
  }

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ message: 'slug is required' });
  }

  if (!iconKey || typeof iconKey !== 'string') {
    return res.status(400).json({ message: 'iconKey is required' });
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
      return res.status(409).json({
        message: 'Category name or slug already exists',
      });
    }

    throw error;
  }
});

router.patch('/categories/:id', async (req, res) => {
  const { name, slug, iconKey } = req.body;
  const data: { name?: string; slug?: string; iconKey?: string } = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name must be a string' });
    }
    data.name = name;
  }

  if (slug !== undefined) {
    if (typeof slug !== 'string' || !slug.trim()) {
      return res.status(400).json({ message: 'slug must be a string' });
    }
    data.slug = slug;
  }

  if (iconKey !== undefined) {
    if (typeof iconKey !== 'string' || !iconKey.trim()) {
      return res.status(400).json({ message: 'iconKey must be a string' });
    }
    data.iconKey = iconKey;
  }

  if (!Object.keys(data).length) {
    return res.status(400).json({ message: 'No category fields provided' });
  }

  try {
    const category = await updateCategory(String(req.params.id), data);

    return res.json({
      message: 'Category updated',
      category,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return res.status(409).json({
        message: 'Category name or slug already exists',
      });
    }

    throw error;
  }
});

router.delete('/categories/:id', async (req, res) => {
  const result = await deleteCategory(String(req.params.id));

  if (result.status === 'missing_category') {
    return res.status(404).json({ message: 'Category not found' });
  }

  if (result.status === 'has_offerings') {
    return res.status(409).json({
      message: 'Categories with offerings cannot be deleted',
    });
  }

  return res.json({ message: 'Category deleted' });
});

router.get('/bookings', async (req, res) => {
  const pagination = getPagination(req);
  const [bookings, total] = await Promise.all([
    getAdminBookings(pagination),
    countAdminBookings(),
  ]);

  return res.json({
    message: 'Admin bookings fetched',
    bookings,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.post('/bookings/:id/release-payment', async (req, res) => {
  const result = await releaseBookingPayment(String(req.params.id));

  if (result.status === 'paystack_not_configured') {
    return res.status(503).json({ message: 'Paystack is not configured' });
  }

  if (result.status === 'missing_booking') {
    return res.status(404).json({ message: 'Booking not found' });
  }

  if (result.status === 'booking_not_completed') {
    return res.status(409).json({ message: 'Only completed bookings can be released' });
  }

  if (result.status === 'payment_not_held') {
    return res.status(409).json({ message: 'Booking payment is not paid and held' });
  }

  if (result.status === 'blocked_by_dispute') {
    return res.status(409).json({ message: 'Resolve the active dispute before releasing payout' });
  }

  if (result.status === 'missing_payout_account') {
    return res.status(409).json({ message: 'Artisan payout account is missing or unverified' });
  }

  if (result.status === 'already_released') {
    return res.status(409).json({ message: 'Payment has already been released' });
  }

  return res.json({
    message: 'Payment released to artisan',
    payment: result.payment,
    payout: result.payout,
  });
});

router.post('/disputes/:id/resolve', async (req, res) => {
  const { action, resolution, refundAmount } = req.body;

  if (!['RELEASE', 'REFUND_FULL', 'REFUND_PARTIAL'].includes(action)) {
    return res.status(400).json({
      message: 'action must be RELEASE, REFUND_FULL, or REFUND_PARTIAL',
    });
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
    return res.status(503).json({ message: 'Paystack is not configured' });
  }

  if (result.status === 'missing_dispute') {
    return res.status(404).json({ message: 'Dispute not found' });
  }

  if (result.status === 'already_resolved') {
    return res.status(409).json({ message: 'Dispute is already resolved', dispute: result.dispute });
  }

  if (result.status === 'missing_payment') {
    return res.status(404).json({ message: 'Booking payment not found' });
  }

  if (result.status === 'payment_not_held') {
    return res.status(409).json({ message: 'Only held payments can be resolved through dispute tools' });
  }

  if (result.status === 'invalid_refund_amount') {
    return res.status(400).json({ message: 'refundAmount must be a positive number' });
  }

  if (result.status === 'refund_too_large') {
    return res.status(400).json({ message: 'refundAmount cannot be greater than the original payment amount' });
  }

  if (result.status === 'booking_not_completed') {
    return res.status(409).json({ message: 'Booking must be completed before payout release' });
  }

  if (result.status === 'missing_payout_account') {
    return res.status(409).json({ message: 'Artisan payout account is missing or unverified' });
  }

  if (result.status === 'blocked_by_dispute') {
    return res.status(409).json({ message: 'This dispute must be resolved directly, not via payout release' });
  }

  if (result.status === 'already_released') {
    return res.status(409).json({ message: 'Payout has already been released' });
  }

  if (result.status === 'resolved_release') {
    return res.json({
      message: 'Dispute resolved and payout released',
      dispute: result.dispute,
      payment: result.payment,
      payout: result.payout,
    });
  }

  if (result.status === 'resolved_refund') {
    return res.json({
      message: 'Dispute resolved with refund action',
      dispute: result.dispute,
      payment: result.payment,
      refundReference: result.refundReference,
    });
  }

  return res.status(500).json({ message: 'Unexpected dispute resolution outcome' });
});

router.get('/bookings/:id', async (req, res) => {
  const booking = await getAdminBookingById(String(req.params.id));

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  return res.json({
    message: 'Admin booking fetched',
    booking,
  });
});

router.get('/conversations', async (req, res) => {
  const pagination = getPagination(req);
  const [conversations, total] = await Promise.all([
    getAdminConversations(pagination),
    countAdminConversations(),
  ]);

  return res.json({
    message: 'Admin conversations fetched',
    conversations,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.get('/conversations/:id', async (req, res) => {
  const conversation = await getAdminConversationById(String(req.params.id));

  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  return res.json({
    message: 'Admin conversation fetched',
    conversation,
  });
});

router.get('/conversations/:id/messages', async (req, res) => {
  const conversation = await getAdminConversationById(String(req.params.id));

  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  return res.json({
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
});

router.post('/conversations/:id/notes', async (req, res) => {
  const { body } = req.body;

  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ message: 'body is required' });
  }

  const result = await createAdminConversationNote({
    conversationId: String(req.params.id),
    adminId: (req as any).user.firebaseUid,
    body,
  });

  if (result.status === 'missing_conversation') {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  return res.status(201).json({
    message: 'Admin note created',
    note: result.note,
  });
});

router.post('/conversations/:id/messages', async (req, res) => {
  const { body, imageUrl, imageCloudinaryId } = req.body;
  const hasBody = typeof body === 'string' && body.trim().length > 0;
  const hasImageUrl = typeof imageUrl === 'string' && imageUrl.trim().length > 0;

  if (body !== undefined && typeof body !== 'string') {
    return res.status(400).json({ message: 'body must be a string' });
  }

  if (imageUrl !== undefined && !hasImageUrl) {
    return res.status(400).json({ message: 'imageUrl must be a non-empty string' });
  }

  if (imageCloudinaryId !== undefined && typeof imageCloudinaryId !== 'string') {
    return res.status(400).json({ message: 'imageCloudinaryId must be a string' });
  }

  if (!hasBody && !hasImageUrl) {
    return res.status(400).json({ message: 'body or imageUrl is required' });
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
    return res.status(404).json({ message: 'Conversation not found' });
  }

  return res.status(201).json({
    message: 'Admin message sent',
    chatMessage: result.message,
  });
});

router.get('/reviews', async (req, res) => {
  const pagination = getPagination(req);
  const [reviews, total] = await Promise.all([
    getAdminReviews(pagination),
    countAdminReviews(),
  ]);

  return res.json({
    message: 'Admin reviews fetched',
    reviews,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.delete('/reviews/:id', async (req, res) => {
  const result = await deleteReviewAndRecalculateRating(String(req.params.id));

  if (result.status === 'missing_review') {
    return res.status(404).json({ message: 'Review not found' });
  }

  return res.json({
    message: 'Review deleted',
    artisan: result.artisan,
  });
});

export default router;
