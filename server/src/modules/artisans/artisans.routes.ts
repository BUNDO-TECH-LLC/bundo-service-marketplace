import { Router } from 'express';
import { validateAvailabilitySlotTimes } from '../../lib/bookingSchedule';
import { resolveArtisanLocationInput } from '../../lib/resolveArtisanLocationInput';
import { asyncHandler } from '../../middlewares/errorHandler';
import { BadGatewayError, httpError } from '../../utils/errors';
import { Prisma, Role, OnboardingIntent } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireArtisanOrApplicant } from '../../middlewares/requireArtisanOrApplicant';
import { requireRole } from '../../middlewares/requireRole';
import { getReviewsForArtisan } from '../reviews/reviews.service';
import {
  createOrUpdatePayoutAccount,
  getPayoutAccountForArtisanUser,
} from '../payments/payments.service';
import { setUserOnboardingIntent } from '../users/users.service';
import { getPagination, paginationMeta } from '../../utils/pagination';
import {
  addAvailabilitySlot,
  addPortfolioImage,
  createOrUpdateKycSubmission,
  createOffering,
  createArtisanProfile,
  countArtisans,
  deleteAvailabilitySlotForArtisan,
  deletePortfolioImageForArtisan,
  getAvailabilitySlotsByArtisanId,
  getAvailabilitySlotsForArtisanUser,
  getArtisanById,
  getKycSubmissionForArtisanUser,
  getArtisanProfileDetailsByUserId,
  getArtisanProfileByUserId,
  getArtisans,
  findApprovedArtisanId,
  getCategoryById,
  getOfferingsForArtisanUser,
  getPortfolioImagesByArtisanId,
  getPortfolioImagesForArtisanUser,
  updateAvailabilitySlotForArtisan,
  updateArtisanProfile,
  updatePortfolioImageForArtisan,
} from './artisans.service';
import { env } from '../../config/env';
import { createCloudinarySignedUpload } from '../../utils/cloudinaryUploadConfig';
import {
  assertOwnedCloudinaryImageUrl,
  assertOwnedCloudinaryPublicId,
} from '../../utils/cloudinaryAsset';

const PORTFOLIO_FOLDER = 'bundo/artisan-portfolio';
const KYC_FOLDER = 'bundo/artisan-kyc';

function parseArtisanProfileLocation(body: Record<string, unknown>) {
  const lat =
    typeof body.lat === 'number'
      ? body.lat
      : typeof body.lat === 'string' && body.lat.trim()
        ? Number(body.lat)
        : undefined;
  const lng =
    typeof body.lng === 'number'
      ? body.lng
      : typeof body.lng === 'string' && body.lng.trim()
        ? Number(body.lng)
        : undefined;

  return resolveArtisanLocationInput({
    ...(typeof body.locationId === 'string' ? { locationId: body.locationId } : {}),
    ...(typeof body.city === 'string' ? { city: body.city } : {}),
    ...(typeof body.area === 'string'
      ? { area: body.area }
      : body.area === null
        ? { area: null }
        : {}),
    ...(lat !== undefined && !Number.isNaN(lat) ? { lat } : {}),
    ...(lng !== undefined && !Number.isNaN(lng) ? { lng } : {}),
  });
}

function validateCloudinaryImageInput(
  imageUrl: string,
  folderPrefix: string,
  cloudinaryId?: string
) {
  let publicId: string;

  try {
    publicId = assertOwnedCloudinaryImageUrl(imageUrl, folderPrefix);
  } catch (error) {
    throw httpError(400, error instanceof Error ? error.message : 'Invalid image URL');
  }

  if (cloudinaryId !== undefined) {
    try {
      assertOwnedCloudinaryPublicId(cloudinaryId, folderPrefix, publicId);
    } catch (error) {
      throw httpError(400, error instanceof Error ? error.message : 'Invalid cloudinaryId');
    }
  }

  return publicId;
}

const router = Router();

router.post(
  '/kyc',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const {
      legalName,
      documentType,
      documentNumber,
      documentImageUrl,
      selfieImageUrl,
      address,
      city,
    } = req.body;

    const requiredFields = [
      ['legalName', legalName],
      ['documentType', documentType],
      ['documentNumber', documentNumber],
      ['documentImageUrl', documentImageUrl],
      ['address', address],
      ['city', city],
    ];

    for (const [field, value] of requiredFields) {
      if (!value || typeof value !== 'string' || !value.trim()) {
        throw httpError(400, `${field} is required`);
      }
    }

    if (
      selfieImageUrl !== undefined &&
      selfieImageUrl !== null &&
      (typeof selfieImageUrl !== 'string' || !selfieImageUrl.trim())
    ) {
      throw httpError(400, 'selfieImageUrl must be a string');
    }

    validateCloudinaryImageInput(documentImageUrl, KYC_FOLDER);
    if (typeof selfieImageUrl === 'string' && selfieImageUrl.trim()) {
      validateCloudinaryImageInput(selfieImageUrl, KYC_FOLDER);
    }

    const submission = await createOrUpdateKycSubmission(
      (req as any).user.firebaseUid,
      {
        legalName,
        documentType,
        documentNumber,
        documentImageUrl,
        selfieImageUrl,
        address,
        city,
      }
    );

    if (!submission) {
      throw httpError(404, 'Create an artisan profile before submitting KYC');
    }

    res.status(201).json({
      message: 'KYC submitted',
      submission,
    });
  }
);

router.get(
  '/kyc',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const submission = await getKycSubmissionForArtisanUser(
      (req as any).user.firebaseUid
    );

    res.json({
      message: 'KYC fetched',
      submission,
    });
  }
);

router.post(
  '/kyc/sign-upload',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  asyncHandler(async (_req, res) => {
    const upload = await createCloudinarySignedUpload('bundo/artisan-kyc');

    res.json({
      message: 'KYC upload signature created',
      upload,
    });
  })
);

router.post(
  '/portfolio-images/sign-upload',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  asyncHandler(async (_req, res) => {
    const upload = await createCloudinarySignedUpload('bundo/artisan-portfolio');

    res.json({
      message: 'Upload signature created',
      upload,
    });
  })
);

router.post(
  '/profile',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const { displayName, bio } = req.body;
    const location = parseArtisanProfileLocation(req.body);

    if (!displayName || typeof displayName !== 'string') {
      throw httpError(400, 'displayName is required');
    }

    if (!location) {
      throw httpError(400, 'Provide locationId or city with lat and lng');
    }

    try {
      const profile = await createArtisanProfile({
        userId: (req as any).user.firebaseUid,
        displayName,
        bio,
        city: location.city,
        ...(location.area ? { area: location.area } : {}),
        lat: location.lat,
        lng: location.lng,
      });

      const authUser = (req as any).user;
      if (authUser.role === Role.CUSTOMER) {
        await setUserOnboardingIntent(authUser.firebaseUid, OnboardingIntent.ARTISAN).catch(() => undefined);
      }

      return res.status(201).json({
        message: 'Artisan profile created',
        profile,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw httpError(409, 'Artisan profile already exists');
      }

      throw error;
    }
  }
);

router.patch(
  '/profile',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const { displayName, bio } = req.body;
    const data: {
      displayName?: string;
      bio?: string | null;
      city?: string;
      area?: string | null;
      lat?: number;
      lng?: number;
    } = {};

    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || !displayName.trim()) {
        throw httpError(400, 'displayName must be a string');
      }
      data.displayName = displayName;
    }

    if (bio !== undefined) {
      if (bio !== null && typeof bio !== 'string') {
        throw httpError(400, 'bio must be a string');
      }
      data.bio = bio;
    }

    const hasLocationFields =
      req.body.locationId !== undefined ||
      req.body.city !== undefined ||
      req.body.area !== undefined ||
      req.body.lat !== undefined ||
      req.body.lng !== undefined;

    if (hasLocationFields) {
      const location = parseArtisanProfileLocation(req.body);
      if (!location) {
        throw httpError(400, 'Provide locationId or city with lat and lng');
      }

      data.city = location.city;
      data.area = location.area ?? null;
      data.lat = location.lat;
      data.lng = location.lng;
    }

    if (!Object.keys(data).length) {
      throw httpError(400, 'No profile fields provided');
    }

    try {
      const profile = await updateArtisanProfile(
        (req as any).user.firebaseUid,
        data
      );

      res.json({
        message: 'Artisan profile updated',
        profile,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw httpError(404, 'Create an artisan profile before updating it');
      }

      throw error;
    }
  }
);

router.post(
  '/portfolio-images',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  asyncHandler(async (req, res) => {
    const { cloudinaryId, url, displayOrder } = req.body;

    if (!cloudinaryId || typeof cloudinaryId !== 'string') {
      throw httpError(400, 'cloudinaryId is required');
    }

    if (!url || typeof url !== 'string') {
      throw httpError(400, 'url is required');
    }

    const normalizedOrder =
      displayOrder === undefined ? undefined : Math.floor(Number(displayOrder));

    if (
      normalizedOrder !== undefined &&
      (!Number.isFinite(normalizedOrder) ||
        !Number.isInteger(normalizedOrder) ||
        normalizedOrder < 0)
    ) {
      throw httpError(400, 'displayOrder must be a non-negative integer');
    }

    validateCloudinaryImageInput(url, PORTFOLIO_FOLDER, cloudinaryId);

    const image = await addPortfolioImage((req as any).user.firebaseUid, {
      cloudinaryId,
      url,
      ...(normalizedOrder !== undefined ? { displayOrder: normalizedOrder } : {}),
    });

    if (!image) {
      throw httpError(404, 'Create an artisan profile before adding portfolio images');
    }

    res.status(201).json({
      message: 'Portfolio image added',
      image,
    });
  })
);

router.post(
  '/availability-slots',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const { dayOfWeek, startTime, endTime } = req.body;

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw httpError(400, 'dayOfWeek must be an integer from 0 to 6');
    }

    if (!startTime || typeof startTime !== 'string') {
      throw httpError(400, 'startTime is required');
    }

    if (!endTime || typeof endTime !== 'string') {
      throw httpError(400, 'endTime is required');
    }

    try {
      validateAvailabilitySlotTimes(startTime, endTime);
    } catch (error) {
      throw httpError(400, error instanceof Error ? error.message : 'Invalid availability times');
    }

    const slot = await addAvailabilitySlot((req as any).user.firebaseUid, {
      dayOfWeek,
      startTime,
      endTime,
    });

    if (!slot) {
      throw httpError(404, 'Create an artisan profile before adding availability slots');
    }

    res.status(201).json({
      message: 'Availability slot added',
      slot,
    });
  }
);

router.get(
  '/offerings',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</offerings/me>; rel="successor-version"');
    const offerings = await getOfferingsForArtisanUser(
      (req as any).user.firebaseUid
    );

    if (!offerings) {
      throw httpError(404, 'Create an artisan profile before fetching offerings');
    }

    res.json({
      message: 'Offerings fetched',
      offerings,
    });
  }
);

router.get('/me', verifyFirebaseToken, requireArtisanOrApplicant, asyncHandler(async (req, res) => {
  const profile = await getArtisanProfileDetailsByUserId(
    (req as any).user.firebaseUid
  );

  if (!profile) {
    throw httpError(404, 'Create an artisan profile before fetching it');
  }

  res.json({
    message: 'My artisan profile fetched',
    profile,
  });
}));

router.get('/payout-account', verifyFirebaseToken, requireArtisanOrApplicant, asyncHandler(async (req, res) => {
  const account = await getPayoutAccountForArtisanUser((req as any).user.firebaseUid);

  res.json({
    message: 'Payout account fetched',
    account,
  });
}));

router.post('/payout-account', verifyFirebaseToken, requireArtisanOrApplicant, asyncHandler(async (req, res) => {
  const { bankCode, bankName, accountNumber, accountName } = req.body;

  if (typeof bankCode !== 'string' || !bankCode.trim()) {
    throw httpError(400, 'bankCode is required');
  }

  if (typeof accountNumber !== 'string' || !accountNumber.trim()) {
    throw httpError(400, 'accountNumber is required');
  }

  if (bankName !== undefined && typeof bankName !== 'string') {
    throw httpError(400, 'bankName must be a string');
  }

  if (accountName !== undefined && typeof accountName !== 'string') {
    throw httpError(400, 'accountName must be a string');
  }

  const result = await createOrUpdatePayoutAccount({
    artisanUserId: (req as any).user.firebaseUid,
    bankCode,
    bankName,
    accountNumber,
    accountName,
  });

  if (result.status === 'paystack_not_configured') {
    throw httpError(503, 'Paystack is not configured');
  }

  if (result.status === 'missing_artisan') {
    throw httpError(404, 'Create an artisan profile before adding payout details');
  }

  if (result.status === 'invalid_account_number') {
    throw httpError(400, result.message);
  }

  if (result.status === 'paystack_error') {
    throw new BadGatewayError(result.message, 'PAYSTACK_ERROR');
  }

  if (result.status !== 'saved') {
    throw httpError(500, 'Could not save payout account');
  }

  res.status(201).json({
    message: 'Payout account saved',
    account: result.account,
  });
}));

router.get(
  '/portfolio-images/me',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  asyncHandler(async (req, res) => {
    const images = await getPortfolioImagesForArtisanUser(
      (req as any).user.firebaseUid
    );

    res.json({
      message: 'My portfolio images fetched',
      images: images ?? [],
    });
  })
);

router.patch(
  '/portfolio-images/:id',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const { cloudinaryId, url, displayOrder } = req.body;
    const data: {
      cloudinaryId?: string;
      url?: string;
      displayOrder?: number;
    } = {};

    if (cloudinaryId !== undefined) {
      if (typeof cloudinaryId !== 'string' || !cloudinaryId.trim()) {
        throw httpError(400, 'cloudinaryId must be a string');
      }
      data.cloudinaryId = cloudinaryId;
    }

    if (url !== undefined) {
      if (typeof url !== 'string' || !url.trim()) {
        throw httpError(400, 'url must be a string');
      }
      data.url = url;
    }

    if (data.url !== undefined) {
      validateCloudinaryImageInput(data.url, PORTFOLIO_FOLDER, data.cloudinaryId);
    } else if (data.cloudinaryId !== undefined) {
      try {
        assertOwnedCloudinaryPublicId(data.cloudinaryId, PORTFOLIO_FOLDER);
      } catch (error) {
        throw httpError(400, error instanceof Error ? error.message : 'Invalid cloudinaryId');
      }
    }

    if (displayOrder !== undefined) {
      if (!Number.isInteger(displayOrder) || displayOrder < 0) {
        throw httpError(400, 'displayOrder must be a non-negative integer');
      }
      data.displayOrder = displayOrder;
    }

    if (!Object.keys(data).length) {
      throw httpError(400, 'No portfolio fields provided');
    }

    const result = await updatePortfolioImageForArtisan({
      imageId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
      data,
    });

    if (result.status === 'missing_artisan') {
      throw httpError(404, 'Artisan profile not found');
    }

    if (result.status === 'missing_image') {
      throw httpError(404, 'Portfolio image not found');
    }

    if (result.status === 'forbidden') {
      throw httpError(403, 'You can only update your own portfolio images');
    }

    res.json({
      message: 'Portfolio image updated',
      image: result.image,
    });
  }
);

router.delete(
  '/portfolio-images/:id',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const result = await deletePortfolioImageForArtisan({
      imageId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
    });

    if (result.status === 'missing_artisan') {
      throw httpError(404, 'Artisan profile not found');
    }

    if (result.status === 'missing_image') {
      throw httpError(404, 'Portfolio image not found');
    }

    if (result.status === 'forbidden') {
      throw httpError(403, 'You can only delete your own portfolio images');
    }

    res.json({ message: 'Portfolio image deleted' });
  }
);

router.get(
  '/availability-slots/me',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const slots = await getAvailabilitySlotsForArtisanUser(
      (req as any).user.firebaseUid
    );

    if (!slots) {
      throw httpError(404, 'Artisan profile not found');
    }

    res.json({
      message: 'My availability slots fetched',
      slots,
    });
  }
);

router.patch(
  '/availability-slots/:id',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const { dayOfWeek, startTime, endTime, isActive } = req.body;
    const data: {
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      isActive?: boolean;
    } = {};

    if (dayOfWeek !== undefined) {
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        throw httpError(400, 'dayOfWeek must be an integer from 0 to 6');
      }
      data.dayOfWeek = dayOfWeek;
    }

    if (startTime !== undefined) {
      if (typeof startTime !== 'string' || !startTime.trim()) {
        throw httpError(400, 'startTime must be a string');
      }
      data.startTime = startTime;
    }

    if (endTime !== undefined) {
      if (typeof endTime !== 'string' || !endTime.trim()) {
        throw httpError(400, 'endTime must be a string');
      }
      data.endTime = endTime;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        throw httpError(400, 'isActive must be a boolean');
      }
      data.isActive = isActive;
    }

    if (!Object.keys(data).length) {
      throw httpError(400, 'No availability fields provided');
    }

    if (data.startTime && data.endTime) {
      try {
        validateAvailabilitySlotTimes(data.startTime, data.endTime);
      } catch (error) {
        throw httpError(400, error instanceof Error ? error.message : 'Invalid availability times');
      }
    }

    const result = await updateAvailabilitySlotForArtisan({
      slotId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
      data,
    });

    if (result.status === 'missing_artisan') {
      throw httpError(404, 'Artisan profile not found');
    }

    if (result.status === 'missing_slot') {
      throw httpError(404, 'Availability slot not found');
    }

    if (result.status === 'forbidden') {
      throw httpError(403, 'You can only update your own availability slots');
    }

    res.json({
      message: 'Availability slot updated',
      slot: result.slot,
    });
  }
);

router.delete(
  '/availability-slots/:id',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  async (req, res) => {
    const result = await deleteAvailabilitySlotForArtisan({
      slotId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
    });

    if (result.status === 'missing_artisan') {
      throw httpError(404, 'Artisan profile not found');
    }

    if (result.status === 'missing_slot') {
      throw httpError(404, 'Availability slot not found');
    }

    if (result.status === 'forbidden') {
      throw httpError(403, 'You can only delete your own availability slots');
    }

    res.json({ message: 'Availability slot deleted' });
  }
);

router.get('/', asyncHandler(async (req, res) => {
  const { city, state, area, categoryId, q, sort } = req.query;
  const pagination = getPagination(req);
  const filters = {
    ...(typeof state === 'string' && state.trim() ? { state: state.trim() } : {}),
    ...(typeof city === 'string' && city.trim() && !(typeof state === 'string' && state.trim())
      ? { city: city.trim() }
      : {}),
    ...(typeof area === 'string' ? { area } : {}),
    ...(typeof categoryId === 'string' ? { categoryId } : {}),
    ...(typeof q === 'string' ? { q } : {}),
    ...(typeof sort === 'string' && ['newest', 'rating', 'reviews'].includes(sort)
      ? { sort: sort as 'newest' | 'rating' | 'reviews' }
      : {}),
  };
  const [artisans, total] = await Promise.all([
    getArtisans(filters, pagination),
    countArtisans(filters),
  ]);

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.json({
    message: 'Artisans fetched',
    artisans,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
}));

router.get('/:id/portfolio-images', asyncHandler(async (req, res) => {
  const artisanId = String(req.params.id);
  const artisan = await findApprovedArtisanId(artisanId);

  if (!artisan) {
    throw httpError(404, 'Artisan not found');
  }

  const images = await getPortfolioImagesByArtisanId(artisanId);

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.json({
    message: 'Portfolio images fetched',
    images,
  });
}));

router.get('/:id/availability-slots', asyncHandler(async (req, res) => {
  const artisanId = String(req.params.id);
  const artisan = await findApprovedArtisanId(artisanId);

  if (!artisan) {
    throw httpError(404, 'Artisan not found');
  }

  const slots = await getAvailabilitySlotsByArtisanId(artisanId);

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.json({
    message: 'Availability slots fetched',
    slots,
  });
}));

router.get('/:id/reviews', asyncHandler(async (req, res) => {
  const reviews = await getReviewsForArtisan(String(req.params.id));

  if (!reviews) {
    throw httpError(404, 'Artisan not found');
  }

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.json({
    message: 'Artisan reviews fetched',
    reviews,
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const artisan = await getArtisanById(String(req.params.id));

  if (!artisan) {
    throw httpError(404, 'Artisan not found');
  }

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.json({
    message: 'Artisan fetched',
    artisan,
  });
}));

export default router;
