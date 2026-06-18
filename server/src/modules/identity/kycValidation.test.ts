import { describe, expect, it } from 'vitest';
import {
  normalizeDocumentNumber,
  validateDocumentNumber,
  validateKycPayload,
  validateLegalName,
} from './kycValidation';

describe('validateLegalName', () => {
  it('accepts a standard two-part name', () => {
    expect(validateLegalName('  Chiedu  David  ')).toEqual({ legalName: 'Chiedu David' });
  });

  it('rejects single-word names', () => {
    expect(() => validateLegalName('Madonna')).toThrow(/first name and surname/i);
  });

  it('rejects names with digits', () => {
    expect(() => validateLegalName('John 2 Smith')).toThrow(/letters/i);
  });
});

describe('validateDocumentNumber', () => {
  it('normalizes NIN to 11 digits', () => {
    expect(validateDocumentNumber('NIN', '1234 567 8901')).toEqual({
      documentNumber: '12345678901',
    });
  });

  it('rejects invalid NIN length', () => {
    expect(() => validateDocumentNumber('NIN', '12345')).toThrow(/11 digits/i);
  });

  it('rejects repeated-digit NIN values', () => {
    expect(() => validateDocumentNumber('NIN', '11111111111')).toThrow(/valid NIN/i);
  });

  it('validates BVN length', () => {
    expect(validateDocumentNumber('BVN', '22222222223').documentNumber).toHaveLength(11);
  });
});

describe('validateKycPayload', () => {
  it('returns a normalized payload', () => {
    const payload = validateKycPayload({
      legalName: 'Ada Lovelace',
      documentType: 'NIN',
      documentNumber: '1234-5678-901',
      documentImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/id.jpg',
      address: '12 Admiralty Way, Lekki Phase 1',
      city: 'Lagos',
    });

    expect(payload.documentNumber).toBe('12345678901');
    expect(payload.legalName).toBe('Ada Lovelace');
  });
});

describe('normalizeDocumentNumber', () => {
  it('uppercases passport numbers', () => {
    expect(normalizeDocumentNumber('INTERNATIONAL_PASSPORT', 'a1234567')).toBe('A1234567');
  });
});
