import { NotificationType, Prisma, Role } from '@prisma/client';
import db from '../../db/client';
import { getArtisanProfileByUserId } from '../artisans/artisans.service';
import { workspaceLink } from '../../lib/appLinks';
import { createNotification } from '../notifications/notifications.service';

async function ensureBookingConversationsForUser(input: {
  firebaseUid: string;
  role: Role | null;
}) {
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

    await Promise.all(
      bookingPairs.map((pair) =>
        db.conversation.upsert({
          where: {
            customerId_artisanId: {
              customerId: pair.customerId,
              artisanId: pair.artisanId,
            },
          },
          update: {},
          create: {
            customerId: pair.customerId,
            artisanId: pair.artisanId,
          },
        })
      )
    );

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

  await Promise.all(
    bookingPairs.map((pair) =>
      db.conversation.upsert({
        where: {
          customerId_artisanId: {
            customerId: pair.customerId,
            artisanId: pair.artisanId,
          },
        },
        update: {},
        create: {
          customerId: pair.customerId,
          artisanId: pair.artisanId,
        },
      })
    )
  );

  return null;
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
      where: { artisanId: artisan.id },
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
    where: { customerId: input.firebaseUid },
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

  const messages = await db.message.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { createdAt: 'asc' },
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

  return { status: 'found' as const, conversation, messages };
};
