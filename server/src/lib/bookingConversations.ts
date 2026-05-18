import { BookingStatus } from '@prisma/client';
import db from '../db/client';

export async function attachConversationIdsToBookings<
  T extends { customerId: string; artisanId: string },
>(bookings: T[]) {
  if (!bookings.length) {
    return bookings.map((booking) => ({ ...booking, conversationId: null as string | null }));
  }

  const conversations = await db.conversation.findMany({
    where: {
      OR: bookings.map((booking) => ({
        customerId: booking.customerId,
        artisanId: booking.artisanId,
      })),
    },
    select: {
      id: true,
      customerId: true,
      artisanId: true,
    },
  });

  const conversationByPair = new Map(
    conversations.map((conversation) => [
      `${conversation.customerId}:${conversation.artisanId}`,
      conversation.id,
    ])
  );

  return bookings.map((booking) => ({
    ...booking,
    conversationId:
      conversationByPair.get(`${booking.customerId}:${booking.artisanId}`) ?? null,
  }));
}

const lifecycleMessages: Partial<Record<BookingStatus, string>> = {
  [BookingStatus.ACCEPTED]:
    'Booking accepted — you are now connected for this appointment. Use this thread to coordinate arrival and service details.',
  [BookingStatus.ONGOING]:
    'Service started — work is now in progress for this booking. Continue coordinating here.',
  [BookingStatus.COMPLETED]:
    'Booking marked completed. Thank the customer in chat if you have not already.',
};

export async function appendBookingLifecycleMessage(input: {
  customerId: string;
  artisanId: string;
  senderId: string;
  status: BookingStatus;
}) {
  const body = lifecycleMessages[input.status];

  if (!body) {
    return;
  }

  const conversation = await db.conversation.findUnique({
    where: {
      customerId_artisanId: {
        customerId: input.customerId,
        artisanId: input.artisanId,
      },
    },
  });

  if (!conversation) {
    return;
  }

  await db.$transaction([
    db.message.create({
      data: {
        conversationId: conversation.id,
        senderId: input.senderId,
        body,
      },
    }),
    db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    }),
  ]);
}
