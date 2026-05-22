import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueArtisan = vi.fn();
const findPayoutAccount = vi.fn();
const updatePayoutAccount = vi.fn();
const createPayoutAccount = vi.fn();
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
      findUnique: (...args: unknown[]) => findPayoutAccount(...args),
      update: (...args: unknown[]) => updatePayoutAccount(...args),
      create: (...args: unknown[]) => createPayoutAccount(...args),
    },
  },
}));

describe('createOrUpdatePayoutAccount', () => {
  beforeEach(() => {
    findUniqueArtisan.mockReset();
    findPayoutAccount.mockReset();
    updatePayoutAccount.mockReset();
    createPayoutAccount.mockReset();
    createPaystackTransferRecipient.mockReset();

    findUniqueArtisan.mockResolvedValue({
      id: 'artisan-1',
      userId: 'uid-1',
      displayName: 'Test Artisan',
    });
    findPayoutAccount.mockResolvedValue(null);
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
    createPayoutAccount.mockResolvedValue({
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
    expect(createPayoutAccount).toHaveBeenCalled();
  });

  it('updates existing payout row without creating a duplicate recipient code', async () => {
    findPayoutAccount
      .mockResolvedValueOnce({
        id: 'payout-1',
        artisanId: 'artisan-1',
        bankCode: '058',
        accountNumber: '0123456789',
        paystackRecipientCode: 'RCP_old',
        isVerified: true,
      })
      .mockResolvedValueOnce(null);

    createPaystackTransferRecipient.mockResolvedValue({
      data: {
        recipient_code: 'RCP_new',
        details: { account_name: 'Test Artisan', bank_name: 'GTBank' },
      },
    });

    updatePayoutAccount.mockResolvedValue({
      id: 'payout-1',
      artisanId: 'artisan-1',
      bankCode: '044',
      accountNumber: '9876543210',
      paystackRecipientCode: 'RCP_new',
      isVerified: true,
    });

    const { createOrUpdatePayoutAccount } = await import('./payments.service');

    const result = await createOrUpdatePayoutAccount({
      artisanUserId: 'uid-1',
      bankCode: '044',
      accountNumber: '9876543210',
    });

    expect(result.status).toBe('saved');
    expect(updatePayoutAccount).toHaveBeenCalled();
    expect(createPayoutAccount).not.toHaveBeenCalled();
  });
});
