import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../utils/errors';
import { resolveAgreedPaymentAmount } from './paymentsAmount';

describe('resolveAgreedPaymentAmount', () => {
  it('uses explicit amount when provided', () => {
    expect(
      resolveAgreedPaymentAmount({
        amount: 12_000,
        agreedAmount: 8_000,
        guideAmount: 15_000,
      })
    ).toBe(12_000);
  });

  it('falls back to stored agreed amount then guide price', () => {
    expect(
      resolveAgreedPaymentAmount({
        agreedAmount: 9_500,
        guideAmount: 15_000,
      })
    ).toBe(9_500);

    expect(
      resolveAgreedPaymentAmount({
        agreedAmount: null,
        guideAmount: 15_000,
      })
    ).toBe(15_000);
  });

  it('explains when guide price alone is below minimum', () => {
    expect(() =>
      resolveAgreedPaymentAmount({
        agreedAmount: null,
        guideAmount: 300,
      })
    ).toThrow(/guide price is below the minimum/i);
  });

  it('rejects invalid amounts', () => {
    expect(() =>
      resolveAgreedPaymentAmount({
        amount: 100,
        agreedAmount: null,
        guideAmount: 15_000,
      })
    ).toThrow(ValidationError);

    expect(() =>
      resolveAgreedPaymentAmount({
        amount: 1.5,
        agreedAmount: null,
        guideAmount: 15_000,
      })
    ).toThrow(ValidationError);
  });
});
