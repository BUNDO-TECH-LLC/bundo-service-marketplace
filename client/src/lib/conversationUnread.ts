import type { Conversation } from '../types';

export function conversationLatestMessage(conversation: Conversation) {
  return conversation.messages?.[0] ?? null;
}

export function conversationIsUnread(conversation: Conversation, currentUserId: string) {
  const latest = conversationLatestMessage(conversation);
  return Boolean(latest && latest.senderId !== currentUserId && !latest.readAt);
}
