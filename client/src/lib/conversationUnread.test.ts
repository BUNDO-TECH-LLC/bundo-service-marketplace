import { describe, expect, it } from 'vitest';
import { conversationIsUnread } from './conversationUnread';
import type { Conversation } from '../types';

function conversationWithLatest(
  senderId: string,
  readAt: string | null | undefined
): Conversation {
  return {
    id: 'conv-1',
    customerId: 'customer-1',
    artisanId: 'artisan-1',
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId,
        body: 'Hello',
        readAt,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  } as Conversation;
}

describe('conversationIsUnread', () => {
  it('is unread when the latest message is from someone else and not read', () => {
    expect(conversationIsUnread(conversationWithLatest('other-user', null), 'me')).toBe(true);
  });

  it('is read when the latest message from someone else has readAt', () => {
    expect(
      conversationIsUnread(conversationWithLatest('other-user', '2026-01-02T00:00:00.000Z'), 'me')
    ).toBe(false);
  });

  it('is not unread when the latest message is mine', () => {
    expect(conversationIsUnread(conversationWithLatest('me', null), 'me')).toBe(false);
  });
});
