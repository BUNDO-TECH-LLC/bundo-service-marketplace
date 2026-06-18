import { describe, expect, it } from 'vitest';
import { formatNinInput, validateKycForm } from './kycValidation';

describe('validateKycForm', () => {
  it('accepts a valid NIN submission', () => {
    const result = validateKycForm({
      legalName: 'Chiedu David',
      documentType: 'NIN',
      documentNumber: '1234 567 8901',
      address: '12 Admiralty Way, Lekki Phase 1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.documentNumber).toBe('12345678901');
    }
  });

  it('rejects an invalid NIN length', () => {
    const result = validateKycForm({
      legalName: 'Chiedu David',
      documentType: 'NIN',
      documentNumber: '12345',
      address: '12 Admiralty Way, Lekki Phase 1',
    });

    expect(result).toEqual({ ok: false, message: 'NIN must be exactly 11 digits.' });
  });
});

describe('formatNinInput', () => {
  it('strips non-digits and caps at 11 characters', () => {
    expect(formatNinInput('12ab345678901234')).toBe('12345678901');
  });
});
