/**
 * Decides whether a payment may move to PAID_HELD without calling Paystack,
 * or must be verified via Paystack, or must be rejected.
 * Keeps production fail-closed when Paystack is not configured.
 */

export type PaymentConfirmGate =
  | { action: 'verify_with_paystack_api' }
  | { action: 'reject'; code: 'paystack_not_configured' }
  | { action: 'accept_without_paystack_verify'; mode: 'simulation' };

export function resolvePaymentConfirmationGate(input: {
  paystackConfigured: boolean;
  nodeEnv: string;
  allowPaymentSimulation: boolean;
}): PaymentConfirmGate {
  if (input.paystackConfigured) {
    return { action: 'verify_with_paystack_api' };
  }

  if (input.nodeEnv === 'production') {
    return { action: 'reject', code: 'paystack_not_configured' };
  }

  if (input.allowPaymentSimulation) {
    return { action: 'accept_without_paystack_verify', mode: 'simulation' };
  }

  return { action: 'reject', code: 'paystack_not_configured' };
}
