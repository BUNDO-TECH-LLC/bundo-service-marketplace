import { Router } from 'express';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireArtisanOrApplicant } from '../../middlewares/requireArtisanOrApplicant';
import { asyncHandler } from '../../middlewares/errorHandler';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { throwOnServiceStatus } from '../../utils/resultErrors';
import {
  countOfferings,
  createOfferingForArtisan,
  deleteOfferingForArtisan,
  getOfferingById,
  getOfferings,
  getOfferingsForArtisanUser,
  updateOfferingForArtisan,
} from './offerings.service';
import { getPagination, paginationMeta } from '../../utils/pagination';
import { MIN_AGREED_PAYMENT_NGN } from '../payments/paymentsAmount';

const router = Router();

const validateOfferingBody = (body: any, partial = false) => {
  const { categoryId, title, description, priceFrom, priceTo } = body;
  const data: {
    categoryId?: string;
    title?: string;
    description?: string | null;
    priceFrom?: number;
    priceTo?: number | null;
  } = {};

  if (!partial || categoryId !== undefined) {
    if (!categoryId || typeof categoryId !== 'string') {
      return { error: 'categoryId is required' };
    }
    data.categoryId = categoryId;
  }

  if (!partial || title !== undefined) {
    if (!title || typeof title !== 'string') {
      return { error: 'title is required' };
    }
    data.title = title;
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return { error: 'description must be a string' };
    }
    data.description = description;
  }

  if (!partial || priceFrom !== undefined) {
    if (!Number.isInteger(priceFrom) || priceFrom < MIN_AGREED_PAYMENT_NGN) {
      return {
        error: `priceFrom must be a whole number of naira, at least ₦${MIN_AGREED_PAYMENT_NGN.toLocaleString('en-NG')}`,
      };
    }
    data.priceFrom = priceFrom;
  }

  if (priceTo !== undefined) {
    if (
      priceTo !== null &&
      (!Number.isInteger(priceTo) ||
        (data.priceFrom !== undefined && priceTo < data.priceFrom))
    ) {
      return {
        error: 'priceTo must be an integer greater than or equal to priceFrom',
      };
    }
    data.priceTo = priceTo;
  }

  if (partial && !Object.keys(data).length) {
    return { error: 'No offering fields provided' };
  }

  return { data };
};

router.post(
  '/',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  asyncHandler(async (req, res) => {
    const validation = validateOfferingBody(req.body);

    if (validation.error || !validation.data) {
      throw new ValidationError(validation.error || 'Invalid offering payload');
    }

    const result = await createOfferingForArtisan({
      artisanUserId: (req as any).user.firebaseUid,
      categoryId: validation.data.categoryId!,
      title: validation.data.title!,
      ...(validation.data.description != null
        ? { description: validation.data.description }
        : {}),
      priceFrom: validation.data.priceFrom!,
      ...(validation.data.priceTo != null ? { priceTo: validation.data.priceTo } : {}),
    });

    throwOnServiceStatus(result.status, {
      missing_artisan: new NotFoundError('Artisan profile'),
      missing_category: new NotFoundError('Category'),
    });

    res.status(201).json({
      message: 'Offering created',
      offering: result.offering,
    });
  })
);

router.get(
  '/me',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  asyncHandler(async (req, res) => {
    const offerings = await getOfferingsForArtisanUser((req as any).user.firebaseUid);

    if (!offerings) {
      throw new NotFoundError('Artisan profile');
    }

    res.json({
      message: 'My offerings fetched',
      offerings,
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { artisanId, categoryId, city, state, q, minPrice, maxPrice, sort, lat, lng } = req.query;
    const pagination = getPagination(req);
    const location =
      typeof state === 'string' ? state : typeof city === 'string' ? city : undefined;
    const filters = {
      ...(typeof artisanId === 'string' ? { artisanId } : {}),
      ...(typeof categoryId === 'string' ? { categoryId } : {}),
      ...(location !== undefined ? { city: location } : {}),
      ...(typeof q === 'string' ? { q } : {}),
      ...(typeof minPrice === 'string' ? { minPrice: Number(minPrice) } : {}),
      ...(typeof maxPrice === 'string' ? { maxPrice: Number(maxPrice) } : {}),
      ...(typeof sort === 'string' &&
      ['newest', 'price_low', 'price_high', 'rating', 'distance'].includes(sort)
        ? { sort: sort as 'newest' | 'price_low' | 'price_high' | 'rating' | 'distance' }
        : {}),
      ...(typeof lat === 'string' && lat.trim() ? { lat: Number(lat) } : {}),
      ...(typeof lng === 'string' && lng.trim() ? { lng: Number(lng) } : {}),
    };

    if (
      (filters.minPrice !== undefined && Number.isNaN(filters.minPrice)) ||
      (filters.maxPrice !== undefined && Number.isNaN(filters.maxPrice)) ||
      (filters.lat !== undefined && Number.isNaN(filters.lat)) ||
      (filters.lng !== undefined && Number.isNaN(filters.lng))
    ) {
      throw new ValidationError('minPrice, maxPrice, lat, and lng must be numbers');
    }

    if (filters.sort === 'distance' && (filters.lat === undefined || filters.lng === undefined)) {
      throw new ValidationError('lat and lng are required when sort=distance');
    }

    const [offerings, total] = await Promise.all([
      getOfferings(filters, pagination),
      countOfferings(filters),
    ]);

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({
      message: 'Offerings fetched',
      offerings,
      meta: {
        ...paginationMeta(pagination),
        total,
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const offering = await getOfferingById(String(req.params.id));

    if (!offering) {
      throw new NotFoundError('Offering');
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({
      message: 'Offering fetched',
      offering,
    });
  })
);

router.patch(
  '/:id',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  asyncHandler(async (req, res) => {
    const validation = validateOfferingBody(req.body, true);

    if (validation.error || !validation.data) {
      throw new ValidationError(validation.error || 'Invalid offering payload');
    }

    const result = await updateOfferingForArtisan({
      offeringId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
      data: validation.data,
    });

    throwOnServiceStatus(result.status, {
      missing_artisan: new NotFoundError('Artisan profile'),
      missing_offering: new NotFoundError('Offering'),
      missing_category: new NotFoundError('Category'),
      forbidden: new ForbiddenError('You can only update your own offerings'),
    });

    res.json({
      message: 'Offering updated',
      offering: result.offering,
    });
  })
);

router.delete(
  '/:id',
  verifyFirebaseToken,
  requireArtisanOrApplicant,
  asyncHandler(async (req, res) => {
    const result = await deleteOfferingForArtisan({
      offeringId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
    });

    throwOnServiceStatus(result.status, {
      missing_artisan: new NotFoundError('Artisan profile'),
      missing_offering: new NotFoundError('Offering'),
      forbidden: new ForbiddenError('You can only delete your own offerings'),
      has_bookings: new ConflictError('Offerings with bookings cannot be deleted'),
    });

    res.json({
      message: 'Offering deleted',
    });
  })
);

export default router;
