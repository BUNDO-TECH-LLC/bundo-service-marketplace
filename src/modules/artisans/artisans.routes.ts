import { Router } from 'express';
import { Prisma, Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireRole } from '../../middlewares/requireRole';
import { getReviewsForArtisan } from '../reviews/reviews.service';
import {
  createOrUpdatePayoutAccount,
  getPayoutAccountForArtisanUser,
} from '../payments/payments.service';
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
  getCategoryById,
  getOfferingsForArtisanUser,
  getPortfolioImagesByArtisanId,
  getPortfolioImagesForArtisanUser,
  updateAvailabilitySlotForArtisan,
  updateArtisanProfile,
  updatePortfolioImageForArtisan,
} from './artisans.service';

const router = Router();

router.post(
  '/kyc',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    try {
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
          return res.status(400).json({ message: `${field} is required` });
        }
      }

      if (
        selfieImageUrl !== undefined &&
        selfieImageUrl !== null &&
        (typeof selfieImageUrl !== 'string' || !selfieImageUrl.trim())
      ) {
        return res.status(400).json({ message: 'selfieImageUrl must be a string' });
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
        return res.status(404).json({
          message: 'Create an artisan profile before submitting KYC',
        });
      }

      return res.status(201).json({
        message: 'KYC submitted',
        submission,
      });
    } catch (error) {
      console.error('POST /artisans/kyc failed', error);
      throw error;
    }
  }
);

router.get(
  '/kyc',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    try {
      const submission = await getKycSubmissionForArtisanUser(
        (req as any).user.firebaseUid
      );

      return res.json({
        message: 'KYC fetched',
        submission,
      });
    } catch (error) {
      console.error('GET /artisans/kyc failed', error);
      throw error;
    }
  }
);

router.post(
  '/profile',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const { displayName, bio, city, area, lat, lng } = req.body;

    if (!displayName || typeof displayName !== 'string') {
      return res.status(400).json({ message: 'displayName is required' });
    }

    if (!city || typeof city !== 'string') {
      return res.status(400).json({ message: 'city is required' });
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        message: 'lat and lng must be numbers',
      });
    }

    try {
      const profile = await createArtisanProfile({
        userId: (req as any).user.firebaseUid,
        displayName,
        bio,
        city,
        area,
        lat,
        lng,
      });

      return res.status(201).json({
        message: 'Artisan profile created',
        profile,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return res.status(409).json({
          message: 'Artisan profile already exists',
        });
      }

      throw error;
    }
  }
);

router.patch(
  '/profile',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const { displayName, bio, city, area, lat, lng } = req.body;
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
        return res.status(400).json({ message: 'displayName must be a string' });
      }
      data.displayName = displayName;
    }

    if (bio !== undefined) {
      if (bio !== null && typeof bio !== 'string') {
        return res.status(400).json({ message: 'bio must be a string' });
      }
      data.bio = bio;
    }

    if (city !== undefined) {
      if (typeof city !== 'string' || !city.trim()) {
        return res.status(400).json({ message: 'city must be a string' });
      }
      data.city = city;
    }

    if (area !== undefined) {
      if (area !== null && typeof area !== 'string') {
        return res.status(400).json({ message: 'area must be a string' });
      }
      data.area = area;
    }

    if (lat !== undefined) {
      if (typeof lat !== 'number') {
        return res.status(400).json({ message: 'lat must be a number' });
      }
      data.lat = lat;
    }

    if (lng !== undefined) {
      if (typeof lng !== 'number') {
        return res.status(400).json({ message: 'lng must be a number' });
      }
      data.lng = lng;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ message: 'No profile fields provided' });
    }

    try {
      const profile = await updateArtisanProfile(
        (req as any).user.firebaseUid,
        data
      );

      return res.json({
        message: 'Artisan profile updated',
        profile,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return res.status(404).json({
          message: 'Create an artisan profile before updating it',
        });
      }

      throw error;
    }
  }
);

router.post(
  '/portfolio-images',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const { cloudinaryId, url, displayOrder } = req.body;

    if (!cloudinaryId || typeof cloudinaryId !== 'string') {
      return res.status(400).json({ message: 'cloudinaryId is required' });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'url is required' });
    }

    if (
      displayOrder !== undefined &&
      (!Number.isInteger(displayOrder) || displayOrder < 0)
    ) {
      return res.status(400).json({
        message: 'displayOrder must be a non-negative integer',
      });
    }

    const image = await addPortfolioImage((req as any).user.firebaseUid, {
      cloudinaryId,
      url,
      displayOrder,
    });

    if (!image) {
      return res.status(404).json({
        message: 'Create an artisan profile before adding portfolio images',
      });
    }

    return res.status(201).json({
      message: 'Portfolio image added',
      image,
    });
  }
);

router.post(
  '/availability-slots',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const { dayOfWeek, startTime, endTime } = req.body;

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        message: 'dayOfWeek must be an integer from 0 to 6',
      });
    }

    if (!startTime || typeof startTime !== 'string') {
      return res.status(400).json({ message: 'startTime is required' });
    }

    if (!endTime || typeof endTime !== 'string') {
      return res.status(400).json({ message: 'endTime is required' });
    }

    const slot = await addAvailabilitySlot((req as any).user.firebaseUid, {
      dayOfWeek,
      startTime,
      endTime,
    });

    if (!slot) {
      return res.status(404).json({
        message: 'Create an artisan profile before adding availability slots',
      });
    }

    return res.status(201).json({
      message: 'Availability slot added',
      slot,
    });
  }
);

router.get(
  '/offerings',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</offerings/me>; rel="successor-version"');
    const offerings = await getOfferingsForArtisanUser(
      (req as any).user.firebaseUid
    );

    if (!offerings) {
      return res.status(404).json({
        message: 'Create an artisan profile before fetching offerings',
      });
    }

    return res.json({
      message: 'Offerings fetched',
      offerings,
    });
  }
);

router.get('/me', verifyFirebaseToken, requireRole(Role.ARTISAN), async (req, res) => {
  const profile = await getArtisanProfileDetailsByUserId(
    (req as any).user.firebaseUid
  );

  if (!profile) {
    return res.status(404).json({
      message: 'Create an artisan profile before fetching it',
    });
  }

  return res.json({
    message: 'My artisan profile fetched',
    profile,
  });
});

router.get('/payout-account', verifyFirebaseToken, requireRole(Role.ARTISAN), async (req, res) => {
  const account = await getPayoutAccountForArtisanUser((req as any).user.firebaseUid);

  return res.json({
    message: 'Payout account fetched',
    account,
  });
});

router.post('/payout-account', verifyFirebaseToken, requireRole(Role.ARTISAN), async (req, res) => {
  const { bankCode, bankName, accountNumber, accountName } = req.body;

  if (typeof bankCode !== 'string' || !bankCode.trim()) {
    return res.status(400).json({ message: 'bankCode is required' });
  }

  if (typeof accountNumber !== 'string' || !accountNumber.trim()) {
    return res.status(400).json({ message: 'accountNumber is required' });
  }

  if (bankName !== undefined && typeof bankName !== 'string') {
    return res.status(400).json({ message: 'bankName must be a string' });
  }

  if (accountName !== undefined && typeof accountName !== 'string') {
    return res.status(400).json({ message: 'accountName must be a string' });
  }

  const result = await createOrUpdatePayoutAccount({
    artisanUserId: (req as any).user.firebaseUid,
    bankCode,
    bankName,
    accountNumber,
    accountName,
  });

  if (result.status === 'paystack_not_configured') {
    return res.status(503).json({ message: 'Paystack is not configured' });
  }

  if (result.status === 'missing_artisan') {
    return res.status(404).json({ message: 'Create an artisan profile before adding payout details' });
  }

  return res.status(201).json({
    message: 'Payout account saved',
    account: result.account,
  });
});

router.get(
  '/portfolio-images/me',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const images = await getPortfolioImagesForArtisanUser(
      (req as any).user.firebaseUid
    );

    if (!images) {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    return res.json({
      message: 'My portfolio images fetched',
      images,
    });
  }
);

router.patch(
  '/portfolio-images/:id',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const { cloudinaryId, url, displayOrder } = req.body;
    const data: {
      cloudinaryId?: string;
      url?: string;
      displayOrder?: number;
    } = {};

    if (cloudinaryId !== undefined) {
      if (typeof cloudinaryId !== 'string' || !cloudinaryId.trim()) {
        return res.status(400).json({ message: 'cloudinaryId must be a string' });
      }
      data.cloudinaryId = cloudinaryId;
    }

    if (url !== undefined) {
      if (typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ message: 'url must be a string' });
      }
      data.url = url;
    }

    if (displayOrder !== undefined) {
      if (!Number.isInteger(displayOrder) || displayOrder < 0) {
        return res.status(400).json({
          message: 'displayOrder must be a non-negative integer',
        });
      }
      data.displayOrder = displayOrder;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ message: 'No portfolio fields provided' });
    }

    const result = await updatePortfolioImageForArtisan({
      imageId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
      data,
    });

    if (result.status === 'missing_artisan') {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    if (result.status === 'missing_image') {
      return res.status(404).json({ message: 'Portfolio image not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only update your own portfolio images',
      });
    }

    return res.json({
      message: 'Portfolio image updated',
      image: result.image,
    });
  }
);

router.delete(
  '/portfolio-images/:id',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const result = await deletePortfolioImageForArtisan({
      imageId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
    });

    if (result.status === 'missing_artisan') {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    if (result.status === 'missing_image') {
      return res.status(404).json({ message: 'Portfolio image not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only delete your own portfolio images',
      });
    }

    return res.json({ message: 'Portfolio image deleted' });
  }
);

router.get(
  '/availability-slots/me',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const slots = await getAvailabilitySlotsForArtisanUser(
      (req as any).user.firebaseUid
    );

    if (!slots) {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    return res.json({
      message: 'My availability slots fetched',
      slots,
    });
  }
);

router.patch(
  '/availability-slots/:id',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
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
        return res.status(400).json({
          message: 'dayOfWeek must be an integer from 0 to 6',
        });
      }
      data.dayOfWeek = dayOfWeek;
    }

    if (startTime !== undefined) {
      if (typeof startTime !== 'string' || !startTime.trim()) {
        return res.status(400).json({ message: 'startTime must be a string' });
      }
      data.startTime = startTime;
    }

    if (endTime !== undefined) {
      if (typeof endTime !== 'string' || !endTime.trim()) {
        return res.status(400).json({ message: 'endTime must be a string' });
      }
      data.endTime = endTime;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive must be a boolean' });
      }
      data.isActive = isActive;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ message: 'No availability fields provided' });
    }

    const result = await updateAvailabilitySlotForArtisan({
      slotId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
      data,
    });

    if (result.status === 'missing_artisan') {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    if (result.status === 'missing_slot') {
      return res.status(404).json({ message: 'Availability slot not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only update your own availability slots',
      });
    }

    return res.json({
      message: 'Availability slot updated',
      slot: result.slot,
    });
  }
);

router.delete(
  '/availability-slots/:id',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const result = await deleteAvailabilitySlotForArtisan({
      slotId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
    });

    if (result.status === 'missing_artisan') {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    if (result.status === 'missing_slot') {
      return res.status(404).json({ message: 'Availability slot not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only delete your own availability slots',
      });
    }

    return res.json({ message: 'Availability slot deleted' });
  }
);

router.get('/', async (req, res) => {
  const { city, state, area, categoryId, q } = req.query;
  const pagination = getPagination(req);
  const location =
    typeof state === 'string'
      ? state
      : typeof city === 'string'
        ? city
        : undefined;
  const filters = {
    city: location,
    area: typeof area === 'string' ? area : undefined,
    categoryId: typeof categoryId === 'string' ? categoryId : undefined,
    q: typeof q === 'string' ? q : undefined,
  };
  const [artisans, total] = await Promise.all([
    getArtisans(filters, pagination),
    countArtisans(filters),
  ]);

  return res.json({
    message: 'Artisans fetched',
    artisans,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.get('/:id/portfolio-images', async (req, res) => {
  const artisan = await getArtisanById(req.params.id);

  if (!artisan) {
    return res.status(404).json({ message: 'Artisan not found' });
  }

  const images = await getPortfolioImagesByArtisanId(req.params.id);

  return res.json({
    message: 'Portfolio images fetched',
    images,
  });
});

router.get('/:id/availability-slots', async (req, res) => {
  const artisan = await getArtisanById(req.params.id);

  if (!artisan) {
    return res.status(404).json({ message: 'Artisan not found' });
  }

  const slots = await getAvailabilitySlotsByArtisanId(req.params.id);

  return res.json({
    message: 'Availability slots fetched',
    slots,
  });
});

router.get('/:id/reviews', async (req, res) => {
  const reviews = await getReviewsForArtisan(String(req.params.id));

  if (!reviews) {
    return res.status(404).json({ message: 'Artisan not found' });
  }

  return res.json({
    message: 'Artisan reviews fetched',
    reviews,
  });
});

router.get('/:id', async (req, res) => {
  const artisan = await getArtisanById(req.params.id);

  if (!artisan) {
    return res.status(404).json({ message: 'Artisan not found' });
  }

  return res.json({
    message: 'Artisan fetched',
    artisan,
  });
});

export default router;
