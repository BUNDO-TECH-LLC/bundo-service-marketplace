import type { KycDocumentType } from './kycValidation';

export type IdentityVerificationStatus =
  | 'manual_review'
  | 'verified'
  | 'failed'
  | 'provider_unavailable';

export type IdentityVerificationResult = {
  status: IdentityVerificationStatus;
  provider: 'dojah' | null;
  reference?: string;
  message: string;
  /** Reserved for Dojah name-match score and raw metadata (never expose PII to clients). */
  meta?: Record<string, unknown>;
};

export type IdentityVerificationInput = {
  legalName: string;
  documentType: KycDocumentType;
  documentNumber: string;
};

/**
 * Provider hook for automated NIN / identity checks.
 * Returns manual_review until Dojah live credentials are configured.
 */
export async function verifyIdentityWithProvider(
  input: IdentityVerificationInput
): Promise<IdentityVerificationResult> {
  const dojahEnabled = Boolean(process.env.DOJAH_APP_ID?.trim() && process.env.DOJAH_SECRET_KEY?.trim());

  if (!dojahEnabled) {
    return {
      status: 'manual_review',
      provider: null,
      message:
        input.documentType === 'NIN'
          ? 'NIN format accepted. Our team will verify your details during review.'
          : 'Identity details accepted. Manual document review is required for this ID type.',
    };
  }

  // Dojah API integration will be implemented here once the merchant account is approved.
  return {
    status: 'provider_unavailable',
    provider: 'dojah',
    message: 'Automated identity verification is being enabled. Your submission will be reviewed manually.',
  };
}
