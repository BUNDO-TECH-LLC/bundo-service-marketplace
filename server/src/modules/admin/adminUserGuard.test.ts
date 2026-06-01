import { Role, UserStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { blocksLastActiveAdminRemoval } from './adminUserGuard';

const activeAdmin = { currentRole: Role.ADMIN, currentStatus: UserStatus.ACTIVE };

describe('blocksLastActiveAdminRemoval', () => {
  it('blocks demoting the only active admin', () => {
    expect(
      blocksLastActiveAdminRemoval({
        ...activeAdmin,
        nextRole: Role.CUSTOMER,
        activeAdminCount: 1,
      })
    ).toBe(true);
  });

  it('blocks banning the only active admin', () => {
    expect(
      blocksLastActiveAdminRemoval({
        ...activeAdmin,
        nextStatus: UserStatus.BANNED,
        activeAdminCount: 1,
      })
    ).toBe(true);
  });

  it('allows demoting one admin when another active admin exists', () => {
    expect(
      blocksLastActiveAdminRemoval({
        ...activeAdmin,
        nextRole: Role.CUSTOMER,
        activeAdminCount: 2,
      })
    ).toBe(false);
  });

  it('allows banning one admin when another active admin exists', () => {
    expect(
      blocksLastActiveAdminRemoval({
        ...activeAdmin,
        nextStatus: UserStatus.BANNED,
        activeAdminCount: 2,
      })
    ).toBe(false);
  });

  it('allows promoting a customer to admin', () => {
    expect(
      blocksLastActiveAdminRemoval({
        currentRole: Role.CUSTOMER,
        currentStatus: UserStatus.ACTIVE,
        nextRole: Role.ADMIN,
        activeAdminCount: 1,
      })
    ).toBe(false);
  });

  it('allows demoting a banned admin even when they are the only admin record', () => {
    expect(
      blocksLastActiveAdminRemoval({
        currentRole: Role.ADMIN,
        currentStatus: UserStatus.BANNED,
        nextRole: Role.CUSTOMER,
        activeAdminCount: 0,
      })
    ).toBe(false);
  });

  it('ignores no-op role and status changes', () => {
    expect(
      blocksLastActiveAdminRemoval({
        ...activeAdmin,
        nextRole: Role.ADMIN,
        activeAdminCount: 1,
      })
    ).toBe(false);

    expect(
      blocksLastActiveAdminRemoval({
        ...activeAdmin,
        nextStatus: UserStatus.ACTIVE,
        activeAdminCount: 1,
      })
    ).toBe(false);
  });
});
