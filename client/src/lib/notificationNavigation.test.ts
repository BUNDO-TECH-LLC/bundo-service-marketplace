import { describe, expect, it } from 'vitest';
import { normalizeNotificationLink, resolveNotificationTarget } from './notificationNavigation';
import type { Notification } from '../types';

function notification(overrides: Partial<Notification>): Notification {
  return {
    id: 'n1',
    userId: 'u1',
    type: 'BOOKING',
    title: 'Test',
    body: 'Body',
    link: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('normalizeNotificationLink', () => {
  it('keeps workspace paths with query params', () => {
    expect(normalizeNotificationLink('/workspace/bookings?job=abc123')).toBe('/workspace/bookings?job=abc123');
  });

  it('maps legacy workspace query links', () => {
    expect(normalizeNotificationLink('?view=workspace&section=messages')).toBe('/workspace/messages');
  });
});

describe('resolveNotificationTarget', () => {
  it('falls back to bookings for booking notifications without a link', () => {
    expect(resolveNotificationTarget(notification({ type: 'BOOKING', link: null }))).toBe('/workspace/bookings');
  });

  it('prefers booking destination over legacy overview links', () => {
    expect(
      resolveNotificationTarget(
        notification({ type: 'BOOKING', link: '/workspace/overview' })
      )
    ).toBe('/workspace/bookings');
  });

  it('uses explicit booking deep links', () => {
    expect(
      resolveNotificationTarget(
        notification({ type: 'BOOKING', link: '/workspace/bookings?job=job-1' })
      )
    ).toBe('/workspace/bookings?job=job-1');
  });
});
