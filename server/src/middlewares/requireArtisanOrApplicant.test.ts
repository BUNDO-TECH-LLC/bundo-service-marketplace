import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingIntent, Role } from '@prisma/client';

const getArtisanProfileByUserId = vi.fn();

vi.mock('../modules/artisans/artisans.service', () => ({
  getArtisanProfileByUserId,
}));

describe('requireArtisanOrApplicant', () => {
  beforeEach(() => {
    getArtisanProfileByUserId.mockReset();
  });

  it('allows customers with artisan onboarding intent', async () => {
    getArtisanProfileByUserId.mockResolvedValueOnce(null);
    const { requireArtisanOrApplicant } = await import('./requireArtisanOrApplicant');
    const next = vi.fn();

    await requireArtisanOrApplicant(
      {
        user: {
          firebaseUid: 'uid-1',
          role: Role.CUSTOMER,
          onboardingIntent: OnboardingIntent.ARTISAN,
        },
        method: 'POST',
        path: '/profile',
      },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('allows customers creating their first profile without onboarding intent', async () => {
    getArtisanProfileByUserId.mockResolvedValueOnce(null);
    const { requireArtisanOrApplicant } = await import('./requireArtisanOrApplicant');
    const next = vi.fn();

    await requireArtisanOrApplicant(
      {
        user: {
          firebaseUid: 'uid-1',
          role: Role.CUSTOMER,
          onboardingIntent: null,
        },
        method: 'POST',
        path: '/profile',
      },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks customers without intent or profile on non-create routes', async () => {
    getArtisanProfileByUserId.mockResolvedValueOnce(null);
    const { requireArtisanOrApplicant } = await import('./requireArtisanOrApplicant');
    const next = vi.fn();

    await requireArtisanOrApplicant(
      {
        user: {
          firebaseUid: 'uid-1',
          role: Role.CUSTOMER,
          onboardingIntent: null,
        },
        method: 'GET',
        path: '/profile',
      },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('account settings') }));
  });
});
