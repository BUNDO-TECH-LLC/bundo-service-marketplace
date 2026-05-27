import { ValidationError } from '../../utils/errors';

export const MIN_AGREED_PAYMENT_NGN = 500;
const MAX_AGREED_AMOUNT_NGN = 50_000_000;

export function resolveAgreedPaymentAmount(input: {
  amount?: number;
  agreedAmount: number | null;
  guideAmount: number;
}) {
  const amount = input.amount ?? input.agreedAmount ?? input.guideAmount;

  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    throw new ValidationError('Amount must be a whole number of naira');
  }

  if (amount < MIN_AGREED_PAYMENT_NGN) {
    const usedGuideOnly =
      input.amount === undefined && input.agreedAmount == null && amount === input.guideAmount;
    if (usedGuideOnly) {
      throw new ValidationError(
        'This listing guide price is below the minimum payment amount. Enter the agreed amount when paying.'
      );
    }
    throw new ValidationError(`Amount must be at least ₦${MIN_AGREED_PAYMENT_NGN.toLocaleString('en-NG')}`);
  }

  if (amount > MAX_AGREED_AMOUNT_NGN) {
    throw new ValidationError('Amount is too large');
  }

  return amount;
}
