import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisputeStatus, PaymentStatus, Role, UserStatus } from '@prisma/client';

const findUnique = vi.fn();
const update = vi.fn();
const createNotifications = vi.fn();

vi.mock('../../db/client', () => ({
  default: {
    dispute: {
      findUnique,
      update,
    },
  },
}));

vi.mock('../notifications/notifications.service', () => ({
  createNotifications,
}));

vi.mock('./paystack.service', () => ({
  isPaystackConfigured: vi.fn(() => true),
}));

describe('resolveBookingDispute CLOSE', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    createNotifications.mockReset();
  });

  const openDispute = {
    id: 'dispute-1',
    status: DisputeStatus.OPEN,
    booking: {
      id: 'booking-1',
      customerId: 'customer-uid',
      artisan: { userId: 'artisan-uid', payoutAccount: null },
      payment: {
        id: 'payment-1',
        status: PaymentStatus.RELEASED,
        amount: 10_000,
        releasedAmount: 8_000,
      },
      payouts: [],
    },
  };

  it('closes an open dispute without changing payment when funds were already released', async () => {
    findUnique.mockResolvedValueOnce(openDispute);
    update.mockResolvedValueOnce({
      ...openDispute,
      status: DisputeStatus.CLOSED,
      resolution: 'Closed by admin admin-uid: Parties agreed amicably',
    });

    const { resolveBookingDispute } = await import('./payments.service');
    const result = await resolveBookingDispute({
      disputeId: 'dispute-1',
      action: 'CLOSE',
      adminId: 'admin-uid',
      resolution: 'Parties agreed amicably',
    });

    expect(result.status).toBe('resolved_close');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dispute-1' },
        data: expect.objectContaining({ status: DisputeStatus.CLOSED }),
      })
    );
    expect(createNotifications).toHaveBeenCalledTimes(1);
  });

  it('requires an admin note to close a dispute', async () => {
    findUnique.mockResolvedValueOnce(openDispute);

    const { resolveBookingDispute } = await import('./payments.service');
    const result = await resolveBookingDispute({
      disputeId: 'dispute-1',
      action: 'CLOSE',
      adminId: 'admin-uid',
      resolution: '   ',
    });

    expect(result.status).toBe('missing_resolution');
    expect(update).not.toHaveBeenCalled();
  });
});
