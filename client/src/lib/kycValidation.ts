export const KYC_DOCUMENT_TYPES = [
  'NIN',
  'BVN',
  'DRIVERS_LICENSE',
  'INTERNATIONAL_PASSPORT',
] as const;

export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

export type KycValidationResult =
  | {
      ok: true;
      legalName: string;
      documentType: KycDocumentType;
      documentNumber: string;
      address: string;
    }
  | { ok: false; message: string };

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

export function validateLegalName(raw: string): { ok: true; legalName: string } | { ok: false; message: string } {
  const legalName = normalizeLegalName(raw);

  if (!legalName) {
    return { ok: false, message: 'Enter your full legal name as it appears on your NIN.' };
  }

  if (legalName.length > 100) {
    return { ok: false, message: 'Legal name is too long.' };
  }

  if (!LEGAL_NAME_PATTERN.test(legalName)) {
    return {
      ok: false,
      message: 'Legal name can only include letters, spaces, hyphens, and apostrophes.',
    };
  }

  const parts = legalName.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return {
      ok: false,
      message: 'Enter your full legal name (first name and surname) exactly as it appears on your NIN.',
    };
  }

  if (parts.some((part) => part.length < 2)) {
    return { ok: false, message: 'Each part of your legal name must be at least 2 characters.' };
  }

  return { ok: true, legalName };
}

function validateDocumentNumber(
  documentType: KycDocumentType,
  raw: string
): { ok: true; documentNumber: string } | { ok: false; message: string } {
  const documentNumber = normalizeDocumentNumber(documentType, raw);

  if (documentType === 'NIN' || documentType === 'BVN') {
    if (documentNumber.length !== 11) {
      return {
        ok: false,
        message: `${documentType === 'NIN' ? 'NIN' : 'BVN'} must be exactly 11 digits.`,
      };
    }

    if (/^(\d)\1{10}$/.test(documentNumber)) {
      return {
        ok: false,
        message: `Enter a valid ${documentType === 'NIN' ? 'NIN' : 'BVN'}.`,
      };
    }

    return { ok: true, documentNumber };
  }

  if (documentType === 'DRIVERS_LICENSE') {
    if (documentNumber.length < 8 || documentNumber.length > 20) {
      return { ok: false, message: "Enter a valid driver's licence number." };
    }

    if (!/^[A-Z0-9]+$/.test(documentNumber)) {
      return {
        ok: false,
        message: "Driver's licence number can only include letters and numbers.",
      };
    }

    return { ok: true, documentNumber };
  }

  if (documentNumber.length < 6 || documentNumber.length > 15) {
    return { ok: false, message: 'Enter a valid passport number.' };
  }

  if (!/^[A-Z0-9]+$/.test(documentNumber)) {
    return { ok: false, message: 'Passport number can only include letters and numbers.' };
  }

  return { ok: true, documentNumber };
}

function validateAddress(raw: string): { ok: true; address: string } | { ok: false; message: string } {
  const address = raw.trim().replace(/\s+/g, ' ');

  if (address.length < 10) {
    return { ok: false, message: 'Enter a complete residential address (at least 10 characters).' };
  }

  if (address.length > 200) {
    return { ok: false, message: 'Residential address is too long.' };
  }

  if (!/[\p{L}]/u.test(address)) {
    return { ok: false, message: 'Enter a valid residential address.' };
  }

  return { ok: true, address };
}

export function documentNumberLabel(documentType: KycDocumentType) {
  switch (documentType) {
    case 'NIN':
      return 'NIN (11 digits)';
    case 'BVN':
      return 'BVN (11 digits)';
    case 'DRIVERS_LICENSE':
      return "Driver's licence number";
    case 'INTERNATIONAL_PASSPORT':
      return 'Passport number';
    default:
      return 'Document number';
  }
}

export function documentNumberPlaceholder(documentType: KycDocumentType) {
  switch (documentType) {
    case 'NIN':
      return '12345678901';
    case 'BVN':
      return '22222222223';
    case 'DRIVERS_LICENSE':
      return 'ABC12345678';
    case 'INTERNATIONAL_PASSPORT':
      return 'A12345678';
    default:
      return '';
  }
}

export function validateKycForm(input: {
  legalName: string;
  documentType: string;
  documentNumber: string;
  address: string;
}): KycValidationResult {
  const legalNameResult = validateLegalName(input.legalName);
  if (!legalNameResult.ok) {
    return legalNameResult;
  }

  const documentType = input.documentType.trim().toUpperCase();
  if (!(KYC_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
    return { ok: false, message: 'Choose a supported document type.' };
  }

  const documentResult = validateDocumentNumber(documentType as KycDocumentType, input.documentNumber);
  if (!documentResult.ok) {
    return documentResult;
  }

  const addressResult = validateAddress(input.address);
  if (!addressResult.ok) {
    return addressResult;
  }

  return {
    ok: true,
    legalName: legalNameResult.legalName,
    documentType: documentType as KycDocumentType,
    documentNumber: documentResult.documentNumber,
    address: addressResult.address,
  };
}

export function formatNinInput(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 11);
}
