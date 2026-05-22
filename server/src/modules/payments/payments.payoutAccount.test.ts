import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueArtisan = vi.fn();
const upsertPayoutAccount = vi.fn();
const createPaystackTransferRecipient = vi.fn();

vi.mock('../artisans/artisans.service', () => ({
  getArtisanProfileByUserId: (...args: unknown[]) => findUniqueArtisan(...args),
}));

vi.mock('./paystack.service', () => ({
  isPaystackConfigured: () => true,
  createPaystackTransferRecipient: (...args: unknown[]) => createPaystackTransferRecipient(...args),
}));

vi.mock('../../db/client', () => ({
  default: {
    providerPayoutAccount: {
      upsert: (...args: unknown[]) => upsertPayoutAccount(...args),
    },
  },
}));

describe('createOrUpdatePayoutAccount', () => {
  beforeEach(() => {
    findUniqueArtisan.mockReset();
    upsertPayoutAccount.mockReset();
    createPaystackTransferRecipient.mockReset();

    findUniqueArtisan.mockResolvedValue({
      id: 'artisan-1',
      userId: 'uid-1',
      displayName: 'Test Artisan',
    });
  });

  it('rejects non-10-digit account numbers before calling Paystack', async () => {
    const { createOrUpdatePayoutAccount } = await import('./payments.service');

    const result = await createOrUpdatePayoutAccount({
      artisanUserId: 'uid-1',
      bankCode: '058',
      accountNumber: '12345',
    });

    expect(result.status).toBe('invalid_account_number');
    expect(createPaystackTransferRecipient).not.toHaveBeenCalled();
  });

  it('returns paystack_error when recipient creation fails', async () => {
    createPaystackTransferRecipient.mockRejectedValue(
      new Error('Account number is not available')
    );

    const { createOrUpdatePayoutAccount } = await import('./payments.service');

    const result = await createOrUpdatePayoutAccount({
      artisanUserId: 'uid-1',
      bankCode: '058',
      accountNumber: '0123456789',
    });

    expect(result.status).toBe('paystack_error');
    expect(result).toMatchObject({ message: 'Account number is not available' });
  });

  it('saves verified payout account when Paystack succeeds', async () => {
    createPaystackTransferRecipient.mockResolvedValue({
      data: {
        recipient_code: 'RCP_test',
        details: {
          account_name: 'Test Artisan',
          bank_name: 'GTBank',
        },
      },
    });
    upsertPayoutAccount.mockResolvedValue({
      id: 'payout-1',
      artisanId: 'artisan-1',
      bankCode: '058',
      accountNumber: '0123456789',
      paystackRecipientCode: 'RCP_test',
      isVerified: true,
    });

    const { createOrUpdatePayoutAccount } = await import('./payments.service');

    const result = await createOrUpdatePayoutAccount({
      artisanUserId: 'uid-1',
      bankCode: '058',
      accountNumber: '0123 456 789',
    });

    expect(result.status).toBe('saved');
    expect(createPaystackTransferRecipient).toHaveBeenCalledWith({
      name: 'Test Artisan',
      accountNumber: '0123456789',
      bankCode: '058',
    });
    expect(upsertPayoutAccount).toHaveBeenCalled();
  });
});
