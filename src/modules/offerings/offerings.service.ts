import { Prisma, VerifyStatus } from '@prisma/client';
import db from '../../db/client';
import { Pagination } from '../../utils/pagination';
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
};

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
      description: input.description,
      priceFrom: input.priceFrom,
      priceTo: input.priceTo,
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

export const getOfferings = async (
  filters: OfferingFilters = {},
  pagination?: Pagination
) => {
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
      gte: filters.minPrice,
      lte: filters.maxPrice,
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
    ];
  }

  return db.offering.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: pagination?.limit,
    skip: pagination?.skip,
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
};

export const countOfferings = async (filters: OfferingFilters = {}) => {
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
      gte: filters.minPrice,
      lte: filters.maxPrice,
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
    ];
  }

  return db.offering.count({ where });
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
