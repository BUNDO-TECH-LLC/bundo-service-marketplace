import { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildUserListWhere } from './admin.service';

describe('buildUserListWhere', () => {
  it('returns undefined when no role filter is provided', () => {
    expect(buildUserListWhere()).toBeUndefined();
    expect(buildUserListWhere({})).toBeUndefined();
  });

  it('filters by admin role', () => {
    expect(buildUserListWhere({ role: Role.ADMIN })).toEqual({ role: Role.ADMIN });
  });

  it('filters booking-only customers when clientsOnly is set', () => {
    expect(buildUserListWhere({ role: Role.CUSTOMER, clientsOnly: true })).toEqual({
      role: Role.CUSTOMER,
      artisanProfile: { is: null },
    });
  });

  it('includes artisan applicants when clientsOnly is false', () => {
    expect(buildUserListWhere({ role: Role.CUSTOMER, clientsOnly: false })).toEqual({
      role: Role.CUSTOMER,
    });
  });
});
