import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../../utils/errors';

const findUnique = vi.fn();
const findFirst = vi.fn();
const getUserByEmail = vi.fn();

vi.mock('../../db/client', () => ({
  default: {
    user: {
      findUnique,
      findFirst,
    },
  },
}));

vi.mock('../../config/firebase', () => ({
  default: {
    auth: () => ({
      getUserByEmail,
    }),
  },
}));

describe('signup availability', () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    getUserByEmail.mockReset();
  });

  it('rejects signup when email exists in Bundo', async () => {
    findUnique.mockResolvedValueOnce({ firebaseUid: 'uid-1', email: 'taken@example.com' });

    const { assertEmailAvailableForSignup } = await import('./signupAvailability.service');

    await expect(assertEmailAvailableForSignup('taken@example.com')).rejects.toBeInstanceOf(ConflictError);
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects signup when email exists in Firebase', async () => {
    findUnique.mockResolvedValueOnce(null);
    getUserByEmail.mockResolvedValueOnce({ uid: 'firebase-uid' });

    const { assertEmailAvailableForSignup } = await import('./signupAvailability.service');

    await expect(assertEmailAvailableForSignup('firebase@example.com')).rejects.toMatchObject({
      code: 'EMAIL_IN_USE',
    });
  });

  it('allows signup when email is not registered', async () => {
    findUnique.mockResolvedValueOnce(null);
    getUserByEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });

    const { assertEmailAvailableForSignup } = await import('./signupAvailability.service');

    await expect(assertEmailAvailableForSignup('new@example.com')).resolves.toBeUndefined();
  });

  it('reports whether an email account exists', async () => {
    findUnique.mockResolvedValueOnce(null);
    getUserByEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });
    findUnique.mockResolvedValueOnce({ firebaseUid: 'uid-1', email: 'taken@example.com' });

    const { emailAccountExists } = await import('./signupAvailability.service');

    await expect(emailAccountExists('new@example.com')).resolves.toBe(false);
    await expect(emailAccountExists('taken@example.com')).resolves.toBe(true);
  });

  it('rejects signup when phone is already linked', async () => {
    findFirst.mockResolvedValueOnce({ firebaseUid: 'uid-1', phone: '+2348012345678' });

    const { assertPhoneAvailableForSignup } = await import('./signupAvailability.service');

    await expect(assertPhoneAvailableForSignup('+2348012345678')).rejects.toMatchObject({
      code: 'PHONE_IN_USE',
    });
  });
});
