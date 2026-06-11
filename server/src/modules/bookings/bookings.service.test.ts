import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserStatus, VerifyStatus } from '@prisma/client';

const findUniqueOffering = vi.fn();
const transaction = vi.fn();

vi.mock('../../db/client', () => ({
  default: {
    offering: {
      findUnique: (...args: unknown[]) => findUniqueOffering(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

describe('createBooking', () => {
  beforeEach(() => {
    findUniqueOffering.mockReset();
    transaction.mockReset();
  });

  it('rejects bookings for unapproved artisans', async () => {
    findUniqueOffering.mockResolvedValue({
      id: 'offering-1',
      artisanId: 'artisan-1',
      artisan: {
        verifyStatus: VerifyStatus.PENDING,
        user: { status: UserStatus.ACTIVE },
      },
    });

    const { createBooking } = await import('./bookings.service');
    const result = await createBooking({
      customerId: 'customer-1',
      offeringId: 'offering-1',
    });

    expect(result).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects bookings for banned artisan owners', async () => {
    findUniqueOffering.mockResolvedValue({
      id: 'offering-1',
      artisanId: 'artisan-1',
      artisan: {
        verifyStatus: VerifyStatus.APPROVED,
        user: { status: UserStatus.BANNED },
      },
    });

    const { createBooking } = await import('./bookings.service');
    const result = await createBooking({
      customerId: 'customer-1',
      offeringId: 'offering-1',
    });

    expect(result).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });
});
