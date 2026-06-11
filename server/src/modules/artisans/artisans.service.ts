import { KycStatus, Prisma, VerifyStatus } from '@prisma/client';
import db from '../../db/client';
import { Pagination, paginationArgs } from '../../utils/pagination';
import { ConflictError } from '../../utils/errors';
import { workspaceLink } from '../../lib/appLinks';
import { createNotification } from '../notifications/notifications.service';

type CreateArtisanProfileInput = {
  userId: string;
  displayName: string;
  bio?: string;
  city: string;
  area?: string;
  lat: number;
  lng: number;
};

type CreateOfferingInput = {
  artisanUserId: string;
  categoryId: string;
  title: string;
  description?: string;
  priceFrom: number;
  priceTo?: number;
};

type UpdateArtisanProfileInput = {
  displayName?: string;
  bio?: string | null;
  city?: string;
  area?: string | null;
  lat?: number;
  lng?: number;
};

type ArtisanFilters = {
  city?: string;
  area?: string;
  categoryId?: string;
  q?: string;
  includeUnapproved?: boolean;
  sort?: 'newest' | 'rating' | 'reviews';
};

function buildArtisanWhere(
  filters: ArtisanFilters = {}
): Prisma.ArtisanProfileWhereInput {
  const where: Prisma.ArtisanProfileWhereInput = filters.includeUnapproved
    ? {}
    : { verifyStatus: VerifyStatus.APPROVED };

  if (filters.city) {
    where.city = { equals: filters.city, mode: 'insensitive' };
  }

  if (filters.area) {
    where.area = { equals: filters.area, mode: 'insensitive' };
  }

  if (filters.q) {
    where.OR = [
      { displayName: { contains: filters.q, mode: 'insensitive' } },
      { bio: { contains: filters.q, mode: 'insensitive' } },
      { city: { contains: filters.q, mode: 'insensitive' } },
      { area: { contains: filters.q, mode: 'insensitive' } },
      {
        offerings: {
          some: {
            title: { contains: filters.q, mode: 'insensitive' },
          },
        },
      },
      {
        offerings: {
          some: {
            category: {
              name: { contains: filters.q, mode: 'insensitive' },
            },
          },
        },
      },
    ];
  }

  if (filters.categoryId) {
    where.offerings = {
      some: { categoryId: filters.categoryId },
    };
  }

  return where;
}

function artisanOrderBy(
  sort?: ArtisanFilters['sort']
): Prisma.ArtisanProfileOrderByWithRelationInput | Prisma.ArtisanProfileOrderByWithRelationInput[] {
  switch (sort) {
    case 'reviews':
      return [{ ratingCount: 'desc' }, { avgRating: 'desc' }, { createdAt: 'desc' }];
    case 'rating':
      return [{ avgRating: 'desc' }, { ratingCount: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

export const createArtisanProfile = async (input: CreateArtisanProfileInput) => {
  return db.artisanProfile.create({
    data: input,
  });
};

export const updateArtisanProfile = async (
  userId: string,
  input: UpdateArtisanProfileInput
) => {
  return db.artisanProfile.update({
    where: { userId },
    data: input,
  });
};

export const getArtisans = async (
  filters: ArtisanFilters = {},
  pagination?: Pagination
) => {
  const where = buildArtisanWhere(filters);

  return db.artisanProfile.findMany({
    where,
    orderBy: artisanOrderBy(filters.sort),
    ...paginationArgs(pagination),
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
      createdAt: true,
      offerings: {
        select: {
          id: true,
          title: true,
          priceFrom: true,
          priceTo: true,
          category: true,
        },
        take: 3,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
};

export const countArtisans = async (filters: ArtisanFilters = {}) => {
  return db.artisanProfile.count({ where: buildArtisanWhere(filters) });
};

export const getArtisanById = async (id: string) => {
  return db.artisanProfile.findFirst({
    where: { id, verifyStatus: VerifyStatus.APPROVED },
    include: {
      user: {
        select: {
          firebaseUid: true,
          role: true,
          status: true,
        },
      },
      offerings: true,
      portfolioImages: {
        orderBy: { displayOrder: 'asc' },
      },
      availabilitySlots: {
        where: { isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });
};

export const findApprovedArtisanId = async (id: string) => {
  return db.artisanProfile.findFirst({
    where: { id, verifyStatus: VerifyStatus.APPROVED },
    select: { id: true },
  });
};

export const getArtisanProfileByUserId = async (userId: string) => {
  return db.artisanProfile.findUnique({
    where: { userId },
  });
};

export const getArtisanProfileDetailsByUserId = async (userId: string) => {
  return db.artisanProfile.findUnique({
    where: { userId },
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
        orderBy: { createdAt: 'desc' },
      },
      portfolioImages: {
        orderBy: { displayOrder: 'asc' },
      },
      availabilitySlots: {
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
      kycSubmission: true,
    },
  });
};

export const getCategoryById = async (id: string) => {
  return db.category.findUnique({
    where: { id },
  });
};

export const createOffering = async (input: CreateOfferingInput) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return null;
  }

  return db.offering.create({
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
    },
  });
};

export const addPortfolioImage = async (
  artisanUserId: string,
  input: { cloudinaryId: string; url: string; displayOrder?: number }
) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return db.portfolioImage.create({
    data: {
      artisanId: artisan.id,
      cloudinaryId: input.cloudinaryId,
      url: input.url,
      displayOrder: input.displayOrder ?? 0,
    },
  });
};

export const getPortfolioImagesByArtisanId = async (artisanId: string) => {
  return db.portfolioImage.findMany({
    where: { artisanId },
    orderBy: { displayOrder: 'asc' },
  });
};

export const getKycSubmissionForArtisanUser = async (artisanUserId: string) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return db.artisanKycSubmission.findUnique({
    where: { artisanId: artisan.id },
  });
};

export const createOrUpdateKycSubmission = async (
  artisanUserId: string,
  input: {
    legalName: string;
    documentType: string;
    documentNumber: string;
    documentImageUrl: string;
    selfieImageUrl?: string | null;
    address: string;
    city: string;
  }
) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  const existingSubmission = await db.artisanKycSubmission.findUnique({
    where: { artisanId: artisan.id },
  });

  if (existingSubmission?.status === KycStatus.APPROVED) {
    throw new ConflictError(
      'Your KYC is already approved. Contact support if your verified identity details need to change.',
      'KYC_ALREADY_APPROVED'
    );
  }

  const submission = await db.artisanKycSubmission.upsert({
    where: { artisanId: artisan.id },
    update: {
      ...input,
      status: KycStatus.PENDING,
      reviewNote: null,
      reviewedAt: null,
      submittedAt: new Date(),
    },
    create: {
      artisanId: artisan.id,
      ...input,
      status: KycStatus.PENDING,
    },
  });

  await createNotification({
    userId: artisan.userId,
    type: 'ADMIN',
    title: 'KYC submitted',
    body: 'Your identity documents were submitted for review. We will update you once they are checked.',
    link: workspaceLink('overview'),
  });

  return submission;
};

export const getPortfolioImagesForArtisanUser = async (artisanUserId: string) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return getPortfolioImagesByArtisanId(artisan.id);
};

export const updatePortfolioImageForArtisan = async (input: {
  imageId: string;
  artisanUserId: string;
  data: { cloudinaryId?: string; url?: string; displayOrder?: number };
}) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const image = await db.portfolioImage.findUnique({
    where: { id: input.imageId },
  });

  if (!image) {
    return { status: 'missing_image' as const };
  }

  if (image.artisanId !== artisan.id) {
    return { status: 'forbidden' as const };
  }

  const updated = await db.portfolioImage.update({
    where: { id: input.imageId },
    data: input.data,
  });

  return { status: 'updated' as const, image: updated };
};

export const deletePortfolioImageForArtisan = async (input: {
  imageId: string;
  artisanUserId: string;
}) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const image = await db.portfolioImage.findUnique({
    where: { id: input.imageId },
  });

  if (!image) {
    return { status: 'missing_image' as const };
  }

  if (image.artisanId !== artisan.id) {
    return { status: 'forbidden' as const };
  }

  await db.portfolioImage.delete({
    where: { id: input.imageId },
  });

  return { status: 'deleted' as const };
};

export const addAvailabilitySlot = async (
  artisanUserId: string,
  input: { dayOfWeek: number; startTime: string; endTime: string }
) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return db.availabilitySlot.create({
    data: {
      artisanId: artisan.id,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });
};

export const getAvailabilitySlotsByArtisanId = async (artisanId: string) => {
  return db.availabilitySlot.findMany({
    where: { artisanId, isActive: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
};

export const getAvailabilitySlotsForArtisanUser = async (
  artisanUserId: string
) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return getAvailabilitySlotsByArtisanId(artisan.id);
};

export const updateAvailabilitySlotForArtisan = async (input: {
  slotId: string;
  artisanUserId: string;
  data: {
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    isActive?: boolean;
  };
}) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const slot = await db.availabilitySlot.findUnique({
    where: { id: input.slotId },
  });

  if (!slot) {
    return { status: 'missing_slot' as const };
  }

  if (slot.artisanId !== artisan.id) {
    return { status: 'forbidden' as const };
  }

  const updated = await db.availabilitySlot.update({
    where: { id: input.slotId },
    data: input.data,
  });

  return { status: 'updated' as const, slot: updated };
};

export const deleteAvailabilitySlotForArtisan = async (input: {
  slotId: string;
  artisanUserId: string;
}) => {
  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const slot = await db.availabilitySlot.findUnique({
    where: { id: input.slotId },
  });

  if (!slot) {
    return { status: 'missing_slot' as const };
  }

  if (slot.artisanId !== artisan.id) {
    return { status: 'forbidden' as const };
  }

  await db.availabilitySlot.delete({
    where: { id: input.slotId },
  });

  return { status: 'deleted' as const };
};
