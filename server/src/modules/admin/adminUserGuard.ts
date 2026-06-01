import { Role, UserStatus } from '@prisma/client';

export const LAST_ADMIN_GUARD_MESSAGE =
  'Cannot remove or ban the last active admin account';

/** True when the change would leave zero active admins. */
export function blocksLastActiveAdminRemoval(input: {
  currentRole: Role;
  currentStatus: UserStatus;
  nextRole?: Role;
  nextStatus?: UserStatus;
  activeAdminCount: number;
}): boolean {
  const isActiveAdmin =
    input.currentRole === Role.ADMIN && input.currentStatus === UserStatus.ACTIVE;

  if (!isActiveAdmin) {
    return false;
  }

  const removesAdminRole =
    input.nextRole !== undefined && input.nextRole !== Role.ADMIN;
  const bansAdmin =
    input.nextStatus !== undefined && input.nextStatus === UserStatus.BANNED;

  if (!removesAdminRole && !bansAdmin) {
    return false;
  }

  return input.activeAdminCount <= 1;
}
