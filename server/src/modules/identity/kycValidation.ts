import { ValidationError } from '../../utils/errors';

export const KYC_DOCUMENT_TYPES = [
  'NIN',
  'BVN',
  'DRIVERS_LICENSE',
  'INTERNATIONAL_PASSPORT',
] as const;

export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

const LEGAL_NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;

export function normalizeLegalName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ');
}

export function normalizeDocumentNumber(documentType: KycDocumentType, raw: string) {
  const trimmed = raw.trim();

  if (documentType === 'NIN' || documentType === 'BVN') {
    return trimmed.replace(/\D/g, '');
  }

  return trimmed.replace(/\s+/g, '').toUpperCase();
}

export function validateLegalName(raw: string) {
  const legalName = normalizeLegalName(raw);

  if (!legalName) {
    throw new ValidationError('Enter your full legal name as it appears on your NIN.');
  }

  if (legalName.length > 100) {
    throw new ValidationError('Legal name is too long.');
  }

  if (!LEGAL_NAME_PATTERN.test(legalName)) {
    throw new ValidationError(
      'Legal name can only include letters, spaces, hyphens, and apostrophes.'
    );
  }

  const parts = legalName.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    throw new ValidationError(
      'Enter your full legal name (first name and surname) exactly as it appears on your NIN.'
    );
  }

  if (parts.some((part) => part.length < 2)) {
    throw new ValidationError('Each part of your legal name must be at least 2 characters.');
  }

  return { legalName };
}

export function validateNin(raw: string) {
  const nin = normalizeDocumentNumber('NIN', raw);

  if (nin.length !== 11) {
    throw new ValidationError('NIN must be exactly 11 digits.');
  }

  if (/^(\d)\1{10}$/.test(nin)) {
    throw new ValidationError('Enter a valid NIN.');
  }

  return { documentNumber: nin };
}

export function validateBvn(raw: string) {
  const bvn = normalizeDocumentNumber('BVN', raw);

  if (bvn.length !== 11) {
    throw new ValidationError('BVN must be exactly 11 digits.');
  }

  if (/^(\d)\1{10}$/.test(bvn)) {
    throw new ValidationError('Enter a valid BVN.');
  }

  return { documentNumber: bvn };
}

export function validateDriversLicense(raw: string) {
  const documentNumber = normalizeDocumentNumber('DRIVERS_LICENSE', raw);

  if (documentNumber.length < 8 || documentNumber.length > 20) {
    throw new ValidationError("Enter a valid driver's licence number.");
  }

  if (!/^[A-Z0-9]+$/.test(documentNumber)) {
    throw new ValidationError("Driver's licence number can only include letters and numbers.");
  }

  return { documentNumber };
}

export function validateInternationalPassport(raw: string) {
  const documentNumber = normalizeDocumentNumber('INTERNATIONAL_PASSPORT', raw);

  if (documentNumber.length < 6 || documentNumber.length > 15) {
    throw new ValidationError('Enter a valid passport number.');
  }

  if (!/^[A-Z0-9]+$/.test(documentNumber)) {
    throw new ValidationError('Passport number can only include letters and numbers.');
  }

  return { documentNumber };
}

export function parseKycDocumentType(raw: string): KycDocumentType {
  const normalized = raw.trim().toUpperCase();

  if (!(KYC_DOCUMENT_TYPES as readonly string[]).includes(normalized)) {
    throw new ValidationError('documentType must be NIN, BVN, DRIVERS_LICENSE, or INTERNATIONAL_PASSPORT.');
  }

  return normalized as KycDocumentType;
}

export function validateDocumentNumber(documentType: KycDocumentType, raw: string) {
  switch (documentType) {
    case 'NIN':
      return validateNin(raw);
    case 'BVN':
      return validateBvn(raw);
    case 'DRIVERS_LICENSE':
      return validateDriversLicense(raw);
    case 'INTERNATIONAL_PASSPORT':
      return validateInternationalPassport(raw);
    default:
      throw new ValidationError('Unsupported document type.');
  }
}

export function validateResidentialAddress(raw: string) {
  const address = raw.trim().replace(/\s+/g, ' ');

  if (address.length < 10) {
    throw new ValidationError('Enter a complete residential address (at least 10 characters).');
  }

  if (address.length > 200) {
    throw new ValidationError('Residential address is too long.');
  }

  if (!/[\p{L}]/u.test(address)) {
    throw new ValidationError('Enter a valid residential address.');
  }

  return { address };
}

export type ValidatedKycPayload = {
  legalName: string;
  documentType: KycDocumentType;
  documentNumber: string;
  documentImageUrl: string;
  selfieImageUrl?: string | null;
  address: string;
  city: string;
};

export function validateKycPayload(input: {
  legalName: string;
  documentType: string;
  documentNumber: string;
  documentImageUrl: string;
  selfieImageUrl?: string | null;
  address: string;
  city: string;
}): ValidatedKycPayload {
  const { legalName } = validateLegalName(input.legalName);
  const documentType = parseKycDocumentType(input.documentType);
  const { documentNumber } = validateDocumentNumber(documentType, input.documentNumber);
  const { address } = validateResidentialAddress(input.address);
  const city = input.city.trim();

  if (!city) {
    throw new ValidationError('city is required');
  }

  const documentImageUrl = input.documentImageUrl.trim();
  if (!documentImageUrl) {
    throw new ValidationError('documentImageUrl is required');
  }

  let selfieImageUrl: string | null | undefined = input.selfieImageUrl;
  if (selfieImageUrl !== undefined && selfieImageUrl !== null) {
    const trimmedSelfie = selfieImageUrl.trim();
    selfieImageUrl = trimmedSelfie ? trimmedSelfie : null;
  }

  return {
    legalName,
    documentType,
    documentNumber,
    documentImageUrl,
    selfieImageUrl,
    address,
    city,
  };
}
