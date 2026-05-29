import { Prisma, VerifyStatus } from '@prisma/client';
import db from '../../db/client';
import { Pagination, paginationArgs } from '../../utils/pagination';
import { distanceKm } from '../../lib/geoDistance';
import {
  getArtisanProfileByUserId,
  getCategoryById,
} from '../artisans/artisans.service';

type CreateOfferingInput = {
  artisanUserId: string;
  categoryId: string;
  title: string;
  description?: string;
  priceFrom: number;
  priceTo?: number;
};

type UpdateOfferingInput = {
  categoryId?: string;
  title?: string;
  description?: string | null;
  priceFrom?: number;
  priceTo?: number | null;
};

type OfferingFilters = {
  artisanId?: string;
  categoryId?: string;
  city?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'newest' | 'price_low' | 'price_high' | 'rating' | 'distance';
  lat?: number;
  lng?: number;
};

function buildOfferingWhere(filters: OfferingFilters = {}): Prisma.OfferingWhereInput {
  const where: Prisma.OfferingWhereInput = {
    artisan: { verifyStatus: VerifyStatus.APPROVED },
  };

  if (filters.artisanId) {
    where.artisanId = filters.artisanId;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.city) {
    where.artisan = {
      verifyStatus: VerifyStatus.APPROVED,
      city: { equals: filters.city, mode: 'insensitive' },
    };
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.priceFrom = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    };
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
      {
        category: {
          name: { contains: filters.q, mode: 'insensitive' },
        },
      },
      {
        artisan: {
          displayName: { contains: filters.q, mode: 'insensitive' },
        },
      },
      {
        artisan: {
          area: { contains: filters.q, mode: 'insensitive' },
        },
      },
    ];
  }

  return where;
}

function offeringOrderBy(
  sort?: OfferingFilters['sort']
): Prisma.OfferingOrderByWithRelationInput | Prisma.OfferingOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_low':
      return [{ priceFrom: 'asc' }, { createdAt: 'desc' }];
    case 'price_high':
      return [{ priceFrom: 'desc' }, { createdAt: 'desc' }];
    case 'rating':
      return [
        { artisan: { avgRating: 'desc' } },
        { artisan: { ratingCount: 'desc' } },
        { createdAt: 'desc' },
      ];
    case 'distance':
      return { createdAt: 'desc' };
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

type OfferingWithArtisanCoords = Awaited<ReturnType<typeof db.offering.findMany>>[number] & {
  artisan: { lat?: number; lng?: number };
};

// Distance-sort bounding box. Generous enough to cover a city + suburbs while
// keeping the candidate set small. Precise ordering is still computed in JS.
const DISTANCE_SORT_RADIUS_KM = 100;
const DISTANCE_SORT_CANDIDATE_CAP = 1000;
const KM_PER_DEGREE_LAT = 111.045;

function withinBoundingBox(
  where: Prisma.OfferingWhereInput,
  lat: number,
  lng: number,
  radiusKm: number
): Prisma.OfferingWhereInput {
  const deltaLat = radiusKm / KM_PER_DEGREE_LAT;
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const deltaLng = radiusKm / (KM_PER_DEGREE_LAT * cosLat);

  const artisanFilter = (where.artisan as Prisma.ArtisanProfileWhereInput | undefined) ?? {};

  return {
    ...where,
    artisan: {
      ...artisanFilter,
      lat: { gte: lat - deltaLat, lte: lat + deltaLat },
      lng: { gte: lng - deltaLng, lte: lng + deltaLng },
    },
  };
}

function sortOfferingsByDistance(
  offerings: OfferingWithArtisanCoords[],
  lat: number,
  lng: number
) {
  return [...offerings].sort((left, right) => {
    const leftLat = left.artisan?.lat;
    const leftLng = left.artisan?.lng;
    const rightLat = right.artisan?.lat;
    const rightLng = right.artisan?.lng;

    const leftDistance =
      leftLat != null && leftLng != null ? distanceKm(lat, lng, leftLat, leftLng) : Number.POSITIVE_INFINITY;
    const rightDistance =
      rightLat != null && rightLng != null ? distanceKm(lat, lng, rightLat, rightLng) : Number.POSITIVE_INFINITY;

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

export const createOfferingForArtisan = async (input: CreateOfferingInput) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const category = await getCategoryById(input.categoryId);

  if (!category) {
    return { status: 'missing_category' as const };
  }

  const offering = await db.offering.create({
    data: {
      artisanId: artisan.id,
      categoryId: input.categoryId,
      title: input.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      priceFrom: input.priceFrom,
      ...(input.priceTo !== undefined ? { priceTo: input.priceTo } : {}),
    },
    include: {
      category: true,
      artisan: {
        select: {
          id: true,
          displayName: true,
          city: true,
          area: true,
          avgRating: true,
          ratingCount: true,
          verifyStatus: true,
        },
      },
    },
  });

  return { status: 'created' as const, offering };
};

const artisanPublicSelect = {
  id: true,
  displayName: true,
  city: true,
  area: true,
  lat: true,
  lng: true,
  avgRating: true,
  ratingCount: true,
  verifyStatus: true,
} as const;

export const getOfferings = async (
  filters: OfferingFilters = {},
  pagination?: Pagination
) => {
  const where = buildOfferingWhere(filters);
  const useDistanceSort =
    filters.sort === 'distance' &&
    filters.lat !== undefined &&
    filters.lng !== undefined &&
    !Number.isNaN(filters.lat) &&
    !Number.isNaN(filters.lng);

  const include = {
    category: true,
    artisan: { select: artisanPublicSelect },
  };

  if (useDistanceSort) {
    // Prefilter to a bounding box around the requested point so we don't load the
    // whole table into memory just to sort by distance. The box is generous (covers
    // a metro area + suburbs); precise ordering is still done in JS below.
    const boundedWhere = withinBoundingBox(where, filters.lat!, filters.lng!, DISTANCE_SORT_RADIUS_KM);
    const rows = await db.offering.findMany({
      where: boundedWhere,
      include,
      take: DISTANCE_SORT_CANDIDATE_CAP,
    });
    const sorted = sortOfferingsByDistance(rows as OfferingWithArtisanCoords[], filters.lat!, filters.lng!);
    if (!pagination) {
      return sorted;
    }
    const skip = (pagination.page - 1) * pagination.limit;
    return sorted.slice(skip, skip + pagination.limit);
  }

  return db.offering.findMany({
    where,
    orderBy: offeringOrderBy(filters.sort),
    ...paginationArgs(pagination),
    include,
  });
};

export const countOfferings = async (filters: OfferingFilters = {}) => {
  return db.offering.count({ where: buildOfferingWhere(filters) });
};

export const getOfferingById = async (id: string) => {
  return db.offering.findFirst({
    where: {
      id,
      artisan: { verifyStatus: VerifyStatus.APPROVED },
    },
    include: {
      category: true,
      artisan: {
        select: {
          id: true,
          displayName: true,
          bio: true,
          city: true,
          area: true,
          lat: true,
          lng: true,
          avgRating: true,
          ratingCount: true,
          verifyStatus: true,
        },
      },
    },
  });
};

export const getOfferingsForArtisanUser = async (artisanUserId: string) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return db.offering.findMany({
    where: { artisanId: artisan.id },
    orderBy: { createdAt: 'desc' },
    include: {
      category: true,
      artisan: {
        select: {
          id: true,
          displayName: true,
          city: true,
          area: true,
        },
      },
    },
  });
};

export const updateOfferingForArtisan = async (input: {
  offeringId: string;
  artisanUserId: string;
  data: UpdateOfferingInput;
}) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const offering = await db.offering.findUnique({
    where: { id: input.offeringId },
  });

  if (!offering) {
    return { status: 'missing_offering' as const };
  }

  if (offering.artisanId !== artisan.id) {
    return { status: 'forbidden' as const };
  }

  if (input.data.categoryId) {
    const category = await getCategoryById(input.data.categoryId);

    if (!category) {
      return { status: 'missing_category' as const };
    }
  }

  const updated = await db.offering.update({
    where: { id: input.offeringId },
    data: input.data,
    include: {
      category: true,
      artisan: {
        select: {
          id: true,
          displayName: true,
          city: true,
          area: true,
        },
      },
    },
  });

  return { status: 'updated' as const, offering: updated };
};

export const deleteOfferingForArtisan = async (input: {
  offeringId: string;
  artisanUserId: string;
}) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const offering = await db.offering.findUnique({
    where: { id: input.offeringId },
    include: {
      _count: {
        select: { bookings: true },
      },
    },
  });

  if (!offering) {
    return { status: 'missing_offering' as const };
  }

  if (offering.artisanId !== artisan.id) {
    return { status: 'forbidden' as const };
  }

  if (offering._count.bookings > 0) {
    return { status: 'has_bookings' as const };
  }

  await db.offering.delete({
    where: { id: input.offeringId },
  });

  return { status: 'deleted' as const };
};
