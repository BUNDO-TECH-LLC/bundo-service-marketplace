import { describe, expect, it } from 'vitest';
import { resolvePaymentConfirmationGate } from './paymentConfirmPolicy';

describe('resolvePaymentConfirmationGate', () => {
  it('requires Paystack API verification when Paystack is configured', () => {
    expect(
      resolvePaymentConfirmationGate({
        paystackConfigured: true,
        nodeEnv: 'production',
        allowPaymentSimulation: false,
      })
    ).toEqual({ action: 'verify_with_paystack_api' });

    expect(
      resolvePaymentConfirmationGate({
        paystackConfigured: true,
        nodeEnv: 'development',
        allowPaymentSimulation: true,
      })
    ).toEqual({ action: 'verify_with_paystack_api' });
  });

  it('rejects in production when Paystack is not configured', () => {
    expect(
      resolvePaymentConfirmationGate({
        paystackConfigured: false,
        nodeEnv: 'production',
        allowPaymentSimulation: false,
      })
    ).toEqual({ action: 'reject', code: 'paystack_not_configured' });

    expect(
      resolvePaymentConfirmationGate({
        paystackConfigured: false,
        nodeEnv: 'production',
        allowPaymentSimulation: true,
      })
    ).toEqual({ action: 'reject', code: 'paystack_not_configured' });
  });

  it('allows simulation in non-production when Paystack is not configured and flag is true', () => {
    expect(
      resolvePaymentConfirmationGate({
        paystackConfigured: false,
        nodeEnv: 'development',
        allowPaymentSimulation: true,
      })
    ).toEqual({ action: 'accept_without_paystack_verify', mode: 'simulation' });

    expect(
      resolvePaymentConfirmationGate({
        paystackConfigured: false,
        nodeEnv: 'test',
        allowPaymentSimulation: true,
      })
    ).toEqual({ action: 'accept_without_paystack_verify', mode: 'simulation' });
  });

  it('rejects in non-production when simulation is off or false', () => {
    expect(
      resolvePaymentConfirmationGate({
        paystackConfigured: false,
        nodeEnv: 'development',
        allowPaymentSimulation: false,
      })
    ).toEqual({ action: 'reject', code: 'paystack_not_configured' });

    expect(
      resolvePaymentConfirmationGate({
        paystackConfigured: false,
        nodeEnv: 'test',
        allowPaymentSimulation: false,
      })
    ).toEqual({ action: 'reject', code: 'paystack_not_configured' });
  });
});
