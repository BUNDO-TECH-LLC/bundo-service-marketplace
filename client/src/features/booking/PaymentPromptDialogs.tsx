import { FormEvent, useEffect, useState } from 'react';
import {
  agreedAmountInputValue,
  bookingDate,
  bookingGuidePrice,
  MIN_PAYMENT_AMOUNT_NGN,
  parseAgreedAmountInput,
} from '../../lib/bookingDisplay';
import { money } from '../../lib/formatting';
import type { Booking } from '../../types';

type PaymentAmountDialogProps = {
  open: boolean;
  booking: Booking | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (amount: number) => void;
};

type PaymentConfirmDialogProps = {
  open: boolean;
  booking: Booking | null;
  amount: number;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

function bookingSummary(booking: Booking) {
  const artisanName =
    booking.artisan?.displayName || booking.offering?.artisan?.displayName || 'Your artisan';
  const serviceTitle = booking.offering?.title || 'Service booking';
  const guidePrice = bookingGuidePrice(booking);

  return { artisanName, serviceTitle, guidePrice };
}

export function PaymentAmountDialog({
  open,
  booking,
  busy,
  onCancel,
  onConfirm,
}: PaymentAmountDialogProps) {
  const [amountInput, setAmountInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !booking) {
      return;
    }

    const preset = agreedAmountInputValue(booking);
    const guide = bookingGuidePrice(booking);
    setAmountInput(preset || (guide ? String(guide) : ''));
    setError('');
  }, [open, booking]);

  if (!open || !booking) {
    return null;
  }

  const { artisanName, serviceTitle, guidePrice } = bookingSummary(booking);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = parseAgreedAmountInput(amountInput);

    if (!amount || amount < MIN_PAYMENT_AMOUNT_NGN) {
      setError(`Enter at least ₦${MIN_PAYMENT_AMOUNT_NGN.toLocaleString('en-NG')}.`);
      return;
    }

    onConfirm(amount);
  }

  return (
    <div className="payment-prompt-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="payment-prompt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-amount-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="payment-prompt-icon" aria-hidden="true">
          ₦
        </div>
        <p className="payment-prompt-eyebrow">Secure checkout</p>
        <h2 id="payment-amount-title">Confirm payment amount</h2>
        <p className="payment-prompt-lead">
          Enter the amount you agreed with {artisanName}. Funds are held safely until the job is
          completed.
        </p>

        <article className="payment-prompt-summary">
          <div>
            <strong>{serviceTitle}</strong>
            <p>{artisanName}</p>
          </div>
          {guidePrice !== null && (
            <span className="payment-prompt-guide">
              Guide {money(guidePrice)}
            </span>
          )}
        </article>

        <label className="payment-prompt-field" htmlFor="payment-amount-input">
          <span>Amount to pay</span>
          <div className="payment-prompt-input-wrap">
            <span aria-hidden="true">₦</span>
            <input
              id="payment-amount-input"
              name="amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={amountInput}
              onChange={(event) => {
                setAmountInput(event.target.value.replace(/[^\d,]/g, ''));
                setError('');
              }}
              placeholder={guidePrice ? String(guidePrice) : '0'}
              required
            />
          </div>
          <small>Minimum ₦{MIN_PAYMENT_AMOUNT_NGN.toLocaleString('en-NG')}</small>
        </label>

        {error && (
          <p className="payment-prompt-error" role="alert">
            {error}
          </p>
        )}

        <div className="payment-prompt-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="payment-prompt-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Review payment'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function PaymentConfirmDialog({
  open,
  booking,
  amount,
  busy,
  onBack,
  onConfirm,
}: PaymentConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setConfirmText('');
    setError('');
  }, [open, amount]);

  if (!open || !booking) {
    return null;
  }

  const { artisanName, serviceTitle } = bookingSummary(booking);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (confirmText.trim().toUpperCase() !== 'PAY') {
      setError('Type PAY in the box below to continue.');
      return;
    }

    onConfirm();
  }

  return (
    <div className="payment-prompt-backdrop" role="presentation" onClick={onBack}>
      <form
        className="payment-prompt-dialog payment-prompt-dialog--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-confirm-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="payment-prompt-icon payment-prompt-icon--shield" aria-hidden="true">
          ✓
        </div>
        <p className="payment-prompt-eyebrow">Paystack checkout</p>
        <h2 id="payment-confirm-title">Ready to pay securely?</h2>

        <div className="payment-prompt-total">
          <span>Total</span>
          <strong>{money(amount)}</strong>
        </div>

        <article className="payment-prompt-summary payment-prompt-summary--compact">
          <div>
            <strong>{serviceTitle}</strong>
            <p>
              {artisanName}
              {booking.scheduledAt ? ` · ${bookingDate(booking.scheduledAt)}` : ''}
            </p>
          </div>
        </article>

        <p className="payment-prompt-lead">
          You&apos;ll complete payment on Paystack. Bundo holds the funds until the service is done.
        </p>

        <label className="payment-prompt-field" htmlFor="payment-confirm-input">
          <span>Type <strong>PAY</strong> to confirm</span>
          <input
            id="payment-confirm-input"
            name="confirm"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={confirmText}
            onChange={(event) => {
              setConfirmText(event.target.value);
              setError('');
            }}
            placeholder="PAY"
            required
          />
        </label>

        {error && (
          <p className="payment-prompt-error" role="alert">
            {error}
          </p>
        )}

        <div className="payment-prompt-trust">
          <span>Powered by Paystack</span>
          <span>Card · Bank · USSD</span>
        </div>

        <div className="payment-prompt-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onBack}>
            Back
          </button>
          <button type="submit" className="payment-prompt-primary" disabled={busy}>
            {busy ? 'Opening…' : 'Pay now'}
          </button>
        </div>
      </form>
    </div>
  );
}
