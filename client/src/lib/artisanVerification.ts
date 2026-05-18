import type { Artisan, ArtisanKycSubmission, KycStatus, VerifyStatus } from '../types';

export type ArtisanVerificationPhase =
  | 'loading'
  | 'setup'
  | 'awaiting_approval'
  | 'changes_requested'
  | 'rejected'
  | 'approved';

export function artisanVerificationPhase(input: {
  profile: Artisan | null;
  kycStatus: KycStatus | 'NOT_SUBMITTED';
  hydrated: boolean;
}): ArtisanVerificationPhase {
  if (!input.hydrated) {
    return 'loading';
  }

  const profileStatus: VerifyStatus | null = input.profile?.verifyStatus ?? null;
  const kyc = input.kycStatus;

  if (profileStatus === 'APPROVED' && kyc === 'APPROVED') {
    return 'approved';
  }

  if (kyc === 'REJECTED' || profileStatus === 'REJECTED') {
    return 'rejected';
  }

  if (kyc === 'CHANGES_REQUESTED') {
    return 'changes_requested';
  }

  if (
    kyc === 'PENDING' ||
    (kyc !== 'NOT_SUBMITTED' && profileStatus === 'PENDING')
  ) {
    return 'awaiting_approval';
  }

  return 'setup';
}

export function kycStatusLabel(status: KycStatus | 'NOT_SUBMITTED') {
  switch (status) {
    case 'PENDING':
      return 'Awaiting approval';
    case 'CHANGES_REQUESTED':
      return 'Updates requested';
    case 'REJECTED':
      return 'Not approved';
    case 'APPROVED':
      return 'Approved';
    default:
      return 'Not submitted';
  }
}
