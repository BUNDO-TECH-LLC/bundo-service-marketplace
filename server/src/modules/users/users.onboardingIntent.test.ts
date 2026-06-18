import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingIntent, Role } from '@prisma/client';

const findUnique = vi.fn();
const update = vi.fn();

vi.mock('../../db/client', () => ({
  default: {
    user: { findUnique, update },
  },
}));

vi.mock('../../middlewares/authSessionCache', () => ({
  invalidateCachedAuthUser: vi.fn(),
}));

describe('setUserOnboardingIntent', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  it('stores ARTISAN intent for customer accounts', async () => {
    findUnique.mockResolvedValueOnce({
      firebaseUid: 'uid-1',
      role: Role.CUSTOMER,
      onboardingIntent: null,
    });
    update.mockResolvedValueOnce({
      firebaseUid: 'uid-1',
      role: Role.CUSTOMER,
      onboardingIntent: OnboardingIntent.ARTISAN,
    });

    const { setUserOnboardingIntent } = await import('./users.service');
    const result = await setUserOnboardingIntent('uid-1', OnboardingIntent.ARTISAN);

    expect(result.status).toBe('updated');
    expect(update).toHaveBeenCalledWith({
      where: { firebaseUid: 'uid-1' },
      data: { onboardingIntent: OnboardingIntent.ARTISAN },
    });
  });

  it('rejects artisan intent for admin accounts', async () => {
    findUnique.mockResolvedValueOnce({
      firebaseUid: 'admin-1',
      role: Role.ADMIN,
      onboardingIntent: null,
    });

    const { setUserOnboardingIntent } = await import('./users.service');
    const result = await setUserOnboardingIntent('admin-1', OnboardingIntent.ARTISAN);

    expect(result.status).toBe('locked_role');
    expect(update).not.toHaveBeenCalled();
  });
});
