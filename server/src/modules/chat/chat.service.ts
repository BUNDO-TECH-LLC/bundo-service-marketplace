import { ConversationInboxState, NotificationType, Prisma, Role } from '@prisma/client';
import db from '../../db/client';
import { getArtisanProfileByUserId } from '../artisans/artisans.service';
import { workspaceLink } from '../../lib/appLinks';
import { createNotification } from '../notifications/notifications.service';
import logger from '../../utils/logger';

const conversationSyncAt = new Map<string, number>();
const CONVERSATION_SYNC_TTL_MS = 5 * 60_000;

async function ensureBookingConversationsForUser(input: {
  firebaseUid: string;
  role: Role | null;
}) {
  const syncKey = `${input.firebaseUid}:${input.role ?? 'none'}`;
  const lastSync = conversationSyncAt.get(syncKey) ?? 0;

  if (Date.now() - lastSync < CONVERSATION_SYNC_TTL_MS) {
    if (input.role === Role.ARTISAN) {
      return getArtisanProfileByUserId(input.firebaseUid);
    }

    return null;
  }

  if (input.role === Role.ARTISAN) {
    const artisan = await getArtisanProfileByUserId(input.firebaseUid);

    if (!artisan) {
      return null;
    }

    const bookingPairs = await db.booking.findMany({
      where: { artisanId: artisan.id },
      distinct: ['customerId', 'artisanId'],
      select: {
        customerId: true,
        artisanId: true,
      },
    });

    // Single insert with skipDuplicates instead of N upserts (the relation has a
    // unique [customerId, artisanId] constraint, so existing rows are left untouched).
    if (bookingPairs.length) {
      await db.conversation.createMany({
        data: bookingPairs.map((pair) => ({
          customerId: pair.customerId,
          artisanId: pair.artisanId,
        })),
        skipDuplicates: true,
      });
    }

    conversationSyncAt.set(syncKey, Date.now());
    return artisan;
  }

  const bookingPairs = await db.booking.findMany({
    where: { customerId: input.firebaseUid },
    distinct: ['customerId', 'artisanId'],
    select: {
      customerId: true,
      artisanId: true,
    },
  });

  if (bookingPairs.length) {
    await db.conversation.createMany({
      data: bookingPairs.map((pair) => ({
        customerId: pair.customerId,
        artisanId: pair.artisanId,
      })),
      skipDuplicates: true,
    });
  }

  conversationSyncAt.set(syncKey, Date.now());
  return null;
}

async function hasBookingBetween(customerId: string, artisanId: string) {
  const booking = await db.booking.findFirst({
    where: { customerId, artisanId },
    select: { id: true },
  });

  return Boolean(booking);
}

export const createMessage = async (input: {
  senderId: string;
  senderRole: Role | null;
  artisanId?: string;
  conversationId?: string;
  body: string;
  imageUrl?: string;
  imageCloudinaryId?: string;
}) => {
  if (input.conversationId) {
    const conversation = await db.conversation.findUnique({
      where: { id: input.conversationId },
    });

    if (!conversation) {
      return { status: 'missing_conversation' as const };
    }

    const isCustomer = conversation.customerId === input.senderId;
    let isArtisan = false;

    if (input.senderRole === Role.ARTISAN) {
      const artisan = await getArtisanProfileByUserId(input.senderId);
      isArtisan = artisan?.id === conversation.artisanId;
    }

    if (!isCustomer && !isArtisan) {
      return { status: 'forbidden' as const };
    }

    if (isCustomer && conversation.customerInbox !== ConversationInboxState.ACTIVE) {
      return { status: 'forbidden' as const };
    }

    if (isArtisan && conversation.artisanInbox !== ConversationInboxState.ACTIVE) {
      return { status: 'forbidden' as const };
    }

    if (!(await hasBookingBetween(conversation.customerId, conversation.artisanId))) {
      return { status: 'booking_required' as const };
    }

    const message = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdMessage = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: input.senderId,
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
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return createdMessage;
    });

    const recipientUserId = isCustomer
      ? (await db.artisanProfile.findUnique({
          where: { id: conversation.artisanId },
          select: { userId: true, displayName: true },
        }))?.userId
      : conversation.customerId;

    if (recipientUserId) {
      await createNotification({
        userId: recipientUserId,
        type: NotificationType.MESSAGE,
        title: 'New message',
        body: 'You have a new chat message waiting.',
        link: workspaceLink('messages'),
      });
    }

    return { status: 'created' as const, conversation, message };
  }

  if (!input.artisanId) {
    return { status: 'missing_artisan_id' as const };
  }

  const artisan = await db.artisanProfile.findUnique({
    where: { id: input.artisanId },
  });

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  if (artisan.userId === input.senderId) {
    return { status: 'self_message' as const };
  }

  if (!(await hasBookingBetween(input.senderId, input.artisanId))) {
    return { status: 'booking_required' as const };
  }

  const conversation = await db.conversation.upsert({
    where: {
      customerId_artisanId: {
        customerId: input.senderId,
        artisanId: input.artisanId,
      },
    },
    update: {},
    create: {
      customerId: input.senderId,
      artisanId: input.artisanId,
    },
  });

  const message = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdMessage = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: input.senderId,
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
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return createdMessage;
  });

  await createNotification({
    userId: artisan.userId,
    type: NotificationType.MESSAGE,
    title: 'New message',
    body: 'A customer started a conversation with you.',
    link: workspaceLink('messages'),
  });

  return { status: 'created' as const, conversation, message };
};

export const getConversationsForUser = async (input: {
  firebaseUid: string;
  role: Role | null;
}) => {
  if (input.role === Role.ARTISAN) {
    const artisan = await ensureBookingConversationsForUser(input);

    if (!artisan) {
      return [];
    }

    return db.conversation.findMany({
      where: { artisanId: artisan.id, artisanInbox: ConversationInboxState.ACTIVE },
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: {
          select: {
            firebaseUid: true,
            email: true,
            phone: true,
          },
        },
        artisan: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  await ensureBookingConversationsForUser(input);

  return db.conversation.findMany({
    where: { customerId: input.firebaseUid, customerInbox: ConversationInboxState.ACTIVE },
    orderBy: { updatedAt: 'desc' },
    include: {
      artisan: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
};

export const getConversationMessages = async (input: {
  conversationId: string;
  firebaseUid: string;
  role: Role | null;
}) => {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
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
      artisan: true,
    },
  });

  if (!conversation) {
    return { status: 'missing_conversation' as const };
  }

  const isCustomer = conversation.customerId === input.firebaseUid;
  let isArtisan = false;

  if (input.role === Role.ARTISAN) {
    const artisan = await getArtisanProfileByUserId(input.firebaseUid);
    isArtisan = artisan?.id === conversation.artisanId;
  }

  if (!isCustomer && !isArtisan) {
    return { status: 'forbidden' as const };
  }

  if (isCustomer && conversation.customerInbox !== ConversationInboxState.ACTIVE) {
    return { status: 'forbidden' as const };
  }

  if (isArtisan && conversation.artisanInbox !== ConversationInboxState.ACTIVE) {
    return { status: 'forbidden' as const };
  }

  // Cap to the most recent messages to bound payload/query cost, then return
  // them in chronological order for rendering.
  const recent = await db.message.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { createdAt: 'desc' },
    take: 200,
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
  const messages = recent.reverse();

  return { status: 'found' as const, conversation, messages };
};

export async function updateMyConversationInboxState(input: {
  conversationId: string;
  firebaseUid: string;
  role: Role | null;
  inbox: 'ACTIVE' | 'SPAM' | 'ARCHIVED';
}) {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
  });

  if (!conversation) {
    return { status: 'missing_conversation' as const };
  }

  const isCustomer = conversation.customerId === input.firebaseUid;
  let isArtisan = false;

  if (input.role === Role.ARTISAN) {
    const artisan = await getArtisanProfileByUserId(input.firebaseUid);
    isArtisan = Boolean(artisan?.id === conversation.artisanId);
  }

  if (!isCustomer && !isArtisan) {
    return { status: 'forbidden' as const };
  }

  const prismaState =
    input.inbox === 'ACTIVE'
      ? ConversationInboxState.ACTIVE
      : input.inbox === 'SPAM'
        ? ConversationInboxState.SPAM
        : ConversationInboxState.ARCHIVED;

  await db.conversation.update({
    where: { id: conversation.id },
    data: isCustomer ? { customerInbox: prismaState } : { artisanInbox: prismaState },
  });

  return { status: 'ok' as const };
}

export async function reportUserInConversation(input: {
  conversationId: string;
  reporterId: string;
  role: Role | null;
  reportedUserId: string;
  detail?: string | null;
}) {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      artisan: { select: { userId: true } },
    },
  });

  if (!conversation) {
    return { status: 'missing_conversation' as const };
  }

  const isCustomer = conversation.customerId === input.reporterId;
  let isArtisan = false;

  if (input.role === Role.ARTISAN) {
    const artisan = await getArtisanProfileByUserId(input.reporterId);
    isArtisan = Boolean(artisan?.id === conversation.artisanId);
  }

  if (!isCustomer && !isArtisan) {
    return { status: 'forbidden' as const };
  }

  const artisanUserId = conversation.artisan.userId;
  const otherPartyId = isCustomer ? artisanUserId : conversation.customerId;

  if (input.reportedUserId !== otherPartyId) {
    return { status: 'invalid_reported_user' as const };
  }

  await db.chatUserReport.create({
    data: {
      conversationId: conversation.id,
      reporterId: input.reporterId,
      reportedUserId: input.reportedUserId,
      detail: input.detail?.trim() || null,
    },
  });

  logger.info(
    {
      conversationId: conversation.id,
      reporterId: input.reporterId,
      reportedUserId: input.reportedUserId,
    },
    'chat_user_report_created'
  );

  return { status: 'ok' as const };
}
