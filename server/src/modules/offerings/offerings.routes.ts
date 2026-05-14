import { Router } from 'express';
import { Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireRole } from '../../middlewares/requireRole';
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
    if (!Number.isInteger(priceFrom) || priceFrom < 0) {
      return { error: 'priceFrom must be a non-negative integer' };
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

router.post('/', verifyFirebaseToken, requireRole(Role.ARTISAN), async (req, res) => {
  const validation = validateOfferingBody(req.body);

  if (validation.error || !validation.data) {
    return res.status(400).json({ message: validation.error });
  }

  const result = await createOfferingForArtisan({
    artisanUserId: (req as any).user.firebaseUid,
    categoryId: validation.data.categoryId!,
    title: validation.data.title!,
    description: validation.data.description ?? undefined,
    priceFrom: validation.data.priceFrom!,
    priceTo: validation.data.priceTo ?? undefined,
  });

  if (result.status === 'missing_artisan') {
    return res.status(404).json({
      message: 'Create an artisan profile before adding offerings',
    });
  }

  if (result.status === 'missing_category') {
    return res.status(404).json({ message: 'Category not found' });
  }

  return res.status(201).json({
    message: 'Offering created',
    offering: result.offering,
  });
});

router.get('/me', verifyFirebaseToken, requireRole(Role.ARTISAN), async (req, res) => {
  const offerings = await getOfferingsForArtisanUser(
    (req as any).user.firebaseUid
  );

  if (!offerings) {
    return res.status(404).json({
      message: 'Create an artisan profile before fetching offerings',
    });
  }

  return res.json({
    message: 'My offerings fetched',
    offerings,
  });
});

router.get('/', async (req, res) => {
  const { artisanId, categoryId, city, state, q, minPrice, maxPrice, sort } =
    req.query;
  const pagination = getPagination(req);
  const location =
    typeof state === 'string'
      ? state
      : typeof city === 'string'
        ? city
        : undefined;
  const filters = {
    artisanId: typeof artisanId === 'string' ? artisanId : undefined,
    categoryId: typeof categoryId === 'string' ? categoryId : undefined,
    city: location,
    q: typeof q === 'string' ? q : undefined,
    minPrice: typeof minPrice === 'string' ? Number(minPrice) : undefined,
    maxPrice: typeof maxPrice === 'string' ? Number(maxPrice) : undefined,
    sort:
      typeof sort === 'string' &&
      ['newest', 'price_low', 'price_high', 'rating'].includes(sort)
        ? (sort as 'newest' | 'price_low' | 'price_high' | 'rating')
        : undefined,
  };

  if (
    (filters.minPrice !== undefined && Number.isNaN(filters.minPrice)) ||
    (filters.maxPrice !== undefined && Number.isNaN(filters.maxPrice))
  ) {
    return res.status(400).json({
      message: 'minPrice and maxPrice must be numbers',
    });
  }

  const [offerings, total] = await Promise.all([
    getOfferings(filters, pagination),
    countOfferings(filters),
  ]);

  return res.json({
    message: 'Offerings fetched',
    offerings,
    meta: {
      ...paginationMeta(pagination),
      total,
    },
  });
});

router.get('/:id', async (req, res) => {
  const offering = await getOfferingById(String(req.params.id));

  if (!offering) {
    return res.status(404).json({ message: 'Offering not found' });
  }

  return res.json({
    message: 'Offering fetched',
    offering,
  });
});

router.patch(
  '/:id',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const validation = validateOfferingBody(req.body, true);

    if (validation.error || !validation.data) {
      return res.status(400).json({ message: validation.error });
    }

    const result = await updateOfferingForArtisan({
      offeringId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
      data: validation.data,
    });

    if (result.status === 'missing_artisan') {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    if (result.status === 'missing_offering') {
      return res.status(404).json({ message: 'Offering not found' });
    }

    if (result.status === 'missing_category') {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only update your own offerings',
      });
    }

    return res.json({
      message: 'Offering updated',
      offering: result.offering,
    });
  }
);

router.delete(
  '/:id',
  verifyFirebaseToken,
  requireRole(Role.ARTISAN),
  async (req, res) => {
    const result = await deleteOfferingForArtisan({
      offeringId: String(req.params.id),
      artisanUserId: (req as any).user.firebaseUid,
    });

    if (result.status === 'missing_artisan') {
      return res.status(404).json({ message: 'Artisan profile not found' });
    }

    if (result.status === 'missing_offering') {
      return res.status(404).json({ message: 'Offering not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({
        message: 'You can only delete your own offerings',
      });
    }

    if (result.status === 'has_bookings') {
      return res.status(409).json({
        message: 'Offerings with bookings cannot be deleted',
      });
    }

    return res.json({
      message: 'Offering deleted',
    });
  }
);

export default router;
