import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../../utils/errors';

const findUniqueArtisan = vi.fn();
const findUniqueKyc = vi.fn();
const findFirstKyc = vi.fn();
const upsertKyc = vi.fn();
const createNotification = vi.fn();

vi.mock('../../db/client', () => ({
  default: {
    artisanProfile: {
      findUnique: (...args: unknown[]) => findUniqueArtisan(...args),
    },
    artisanKycSubmission: {
      findUnique: (...args: unknown[]) => findUniqueKyc(...args),
      findFirst: (...args: unknown[]) => findFirstKyc(...args),
      upsert: (...args: unknown[]) => upsertKyc(...args),
    },
  },
}));

vi.mock('../notifications/notifications.service', () => ({
  createNotification: (...args: unknown[]) => createNotification(...args),
}));

describe('createOrUpdateKycSubmission', () => {
  beforeEach(() => {
    findUniqueArtisan.mockReset();
    findUniqueKyc.mockReset();
    findFirstKyc.mockReset();
    upsertKyc.mockReset();
    createNotification.mockReset();

    findUniqueKyc.mockResolvedValue(null);
    findFirstKyc.mockResolvedValue(null);

    findUniqueArtisan.mockResolvedValue({
      id: 'artisan-1',
      userId: 'user-1',
    });
  });

  const input = {
    legalName: 'Ada Artisan',
    documentType: 'NIN',
    documentNumber: '12345678901',
    documentImageUrl: 'https://example.com/id.jpg',
    address: '12 Market Road, Lagos Island',
    city: 'Lagos',
  };

  it('rejects updates to already approved KYC', async () => {
    findUniqueKyc.mockResolvedValueOnce({
      artisanId: 'artisan-1',
      status: 'APPROVED',
    });

    const { createOrUpdateKycSubmission } = await import('./artisans.service');

    await expect(createOrUpdateKycSubmission('user-1', input)).rejects.toBeInstanceOf(
      ConflictError
    );
    expect(upsertKyc).not.toHaveBeenCalled();
  });

  it('allows resubmission when changes were requested', async () => {
    findUniqueKyc.mockResolvedValueOnce({
      artisanId: 'artisan-1',
      status: 'CHANGES_REQUESTED',
    });
    upsertKyc.mockResolvedValueOnce({
      id: 'kyc-1',
      artisanId: 'artisan-1',
      status: 'PENDING',
      ...input,
    });

    const { createOrUpdateKycSubmission } = await import('./artisans.service');

    const submission = await createOrUpdateKycSubmission('user-1', input);

    expect(submission?.status).toBe('PENDING');
    expect(upsertKyc).toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalled();
  });

  it('rejects duplicate NIN already in use', async () => {
    findFirstKyc.mockResolvedValueOnce({ id: 'kyc-other' });

    const { createOrUpdateKycSubmission } = await import('./artisans.service');

    await expect(createOrUpdateKycSubmission('user-1', input)).rejects.toBeInstanceOf(
      ConflictError
    );
    expect(upsertKyc).not.toHaveBeenCalled();
  });
});
