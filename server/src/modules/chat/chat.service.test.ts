import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationInboxState, Role } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  findUniqueConversation: vi.fn(),
  findFirstBooking: vi.fn(),
  findUniqueArtisan: vi.fn(),
  getArtisanProfileByUserId: vi.fn(),
  transaction: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock('../../db/client', () => ({
  default: {
    conversation: {
      findUnique: mocks.findUniqueConversation,
      upsert: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      findFirst: mocks.findFirstBooking,
    },
    artisanProfile: {
      findUnique: mocks.findUniqueArtisan,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../artisans/artisans.service', () => ({
  getArtisanProfileByUserId: mocks.getArtisanProfileByUserId,
}));

vi.mock('../notifications/notifications.service', () => ({
  createNotification: mocks.createNotification,
}));

import { createMessage } from './chat.service';

describe('createMessage booking gate', () => {
  beforeEach(() => {
    mocks.findUniqueConversation.mockReset();
    mocks.findFirstBooking.mockReset();
    mocks.findUniqueArtisan.mockReset();
    mocks.getArtisanProfileByUserId.mockReset();
    mocks.transaction.mockReset();
    mocks.createNotification.mockReset();
  });

  it('rejects new artisan messages without a booking', async () => {
    mocks.findUniqueArtisan.mockResolvedValue({
      id: 'artisan-1',
      userId: 'artisan-user',
    });
    mocks.findFirstBooking.mockResolvedValue(null);

    const result = await createMessage({
      senderId: 'customer-uid',
      senderRole: Role.CUSTOMER,
      artisanId: 'artisan-1',
      body: 'Hello',
    });

    expect(result.status).toBe('booking_required');
  });

  it('rejects conversation replies without a booking', async () => {
    mocks.findUniqueConversation.mockResolvedValue({
      id: 'conv-1',
      customerId: 'customer-uid',
      artisanId: 'artisan-1',
      customerInbox: ConversationInboxState.ACTIVE,
      artisanInbox: ConversationInboxState.ACTIVE,
    });
    mocks.findFirstBooking.mockResolvedValue(null);

    const result = await createMessage({
      senderId: 'customer-uid',
      senderRole: Role.CUSTOMER,
      conversationId: 'conv-1',
      body: 'Hello again',
    });

    expect(result.status).toBe('booking_required');
  });
});
