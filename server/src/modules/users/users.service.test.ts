import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ConflictError } from '../../utils/errors';

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock('../../db/client', () => ({
  default: {
    user: {
      findUnique,
      create,
      update,
    },
  },
}));

describe('findOrCreateUser', () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    update.mockReset();
  });

  it('returns an existing user by firebase uid', async () => {
    const existing = {
      firebaseUid: 'uid-1',
      email: 'user@example.com',
      phone: null,
      role: null,
    };

    findUnique.mockResolvedValueOnce(existing);

    const { findOrCreateUser } = await import('./users.service');
    const user = await findOrCreateUser({
      uid: 'uid-1',
      email: 'user@example.com',
    });

    expect(user).toEqual(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it('re-links an existing email row when firebase uid is new', async () => {
    findUnique.mockResolvedValueOnce(null);
    findUnique.mockResolvedValueOnce({
      firebaseUid: 'old-uid',
      email: 'user@example.com',
      phone: null,
    });

    update.mockResolvedValueOnce({
      firebaseUid: 'new-uid',
      email: 'user@example.com',
      phone: null,
    });

    const { findOrCreateUser } = await import('./users.service');
    const user = await findOrCreateUser({
      uid: 'new-uid',
      email: 'user@example.com',
    });

    expect(update).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      data: { firebaseUid: 'new-uid' },
    });
    expect(user.firebaseUid).toBe('new-uid');
  });

  it('throws a conflict error instead of a 500 on duplicate email create', async () => {
    findUnique.mockResolvedValue(null);
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    const { findOrCreateUser } = await import('./users.service');

    await expect(
      findOrCreateUser({
        uid: 'uid-2',
        email: 'taken@example.com',
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
