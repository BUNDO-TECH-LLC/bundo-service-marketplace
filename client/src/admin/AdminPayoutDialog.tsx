import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { money } from '../lib/formatting';
import type { Booking, Payout, PayoutBank } from '../types';

type ReleaseResponse = {
  requiresOtp?: boolean;
  payout?: Payout;
  fullyReleased?: boolean;
  releaseAmount?: number;
};

const PERCENT_PRESETS = [50, 60, 100];

export function AdminPayoutDialog({
  open,
  booking,
  token,
  onClose,
  onReleased,
}: {
  open: boolean;
  booking: Booking | null;
  token: string;
  onClose: () => void;
  onReleased: (response: ReleaseResponse, booking: Booking) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<'saved' | 'manual'>('saved');
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [percent, setPercent] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMode('saved');
      setBankCode('');
      setAccountNumber('');
      setResolvedName(null);
      setPercent(100);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'manual' || banks.length > 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await api<{ banks: PayoutBank[] }>('/admin/payout/banks', { token });
        if (!cancelled) {
          setBanks(response.banks);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, 'Could not load the bank list.'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mode, banks.length, token]);

  if (!open || !booking) {
    return null;
  }

  const payment = booking.payment;
  const gross = payment?.amount ?? booking.agreedAmount ?? booking.offering?.priceFrom ?? 0;
  const platformFee = payment?.platformFee ?? null;
  const artisanPayout = payment?.providerEarning ?? null;
  const totalEarning = artisanPayout ?? 0;
  const alreadyReleased = payment?.releasedAmount ?? 0;
  const remaining = Math.max(totalEarning - alreadyReleased, 0);
  const thisRelease = Math.min(Math.round(totalEarning * (percent / 100)), remaining);
  const remainingAfter = Math.max(remaining - thisRelease, 0);
  const isFullRelease = thisRelease >= remaining;

  async function verifyAccount() {
    setError(null);
    setResolvedName(null);
    setBusy(true);
    try {
      const response = await api<{ accountName: string }>('/admin/payout/resolve-account', {
        method: 'POST',
        token,
        body: JSON.stringify({ bankCode, accountNumber }),
      });
      setResolvedName(response.accountName);
    } catch (err) {
      setError(errorMessage(err, 'Could not verify this account.'));
    } finally {
      setBusy(false);
    }
  }

  async function release(manual: boolean) {
    if (!booking) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { releasePercent: percent };
      if (manual) {
        payload.bankCode = bankCode;
        payload.accountNumber = accountNumber;
        if (resolvedName) {
          payload.accountName = resolvedName;
        }
      }

      const response = await api<ReleaseResponse>(
        `/admin/bookings/${booking.id}/release-payment`,
        {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        }
      );
      await onReleased(response, booking);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not release this payout.'));
    } finally {
      setBusy(false);
    }
  }

  const manualReady = Boolean(bankCode && /^\d{10}$/.test(accountNumber) && resolvedName);

  return (
    <div className="prompt-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="prompt-dialog admin-payout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-payout-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="admin-payout-title">Release payout</h2>

        <dl className="admin-payout-breakdown">
          <div>
            <dt>Customer paid</dt>
            <dd>{money(gross)}</dd>
          </div>
          <div>
            <dt>Platform fee (kept by Bundo)</dt>
            <dd>{platformFee !== null ? money(platformFee) : '—'}</dd>
          </div>
          <div>
            <dt>Artisan earning (total)</dt>
            <dd>
              <strong>{artisanPayout !== null ? money(artisanPayout) : '—'}</strong>
            </dd>
          </div>
          {alreadyReleased > 0 && (
            <div>
              <dt>Already released</dt>
              <dd>{money(alreadyReleased)}</dd>
            </div>
          )}
        </dl>

        <div className="admin-payout-split">
          <p className="admin-payout-split-label">How much of the artisan earning to send now?</p>
          <div className="admin-payout-percent-presets" role="group" aria-label="Release percentage">
            {PERCENT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={percent === preset ? 'active' : ''}
                disabled={busy}
                onClick={() => setPercent(preset)}
              >
                {preset === 100 ? 'All remaining' : `${preset}%`}
              </button>
            ))}
          </div>
          <label className="admin-payout-percent-custom">
            Custom %
            <input
              type="number"
              min={1}
              max={100}
              value={percent}
              disabled={busy}
              onChange={(event) => {
                const next = Math.max(1, Math.min(100, Math.round(Number(event.target.value) || 0)));
                setPercent(next);
              }}
            />
          </label>
          <dl className="admin-payout-breakdown admin-payout-now">
            <div>
              <dt>Paying now ({percent}% of total)</dt>
              <dd>
                <strong>{money(thisRelease)}</strong>
              </dd>
            </div>
            <div>
              <dt>Remaining held after this</dt>
              <dd>{money(remainingAfter)}</dd>
            </div>
          </dl>
        </div>

        <div className="admin-payout-mode" role="tablist" aria-label="Payout destination">
          <button
            type="button"
            className={mode === 'saved' ? 'active' : ''}
            onClick={() => setMode('saved')}
          >
            Saved bank account
          </button>
          <button
            type="button"
            className={mode === 'manual' ? 'active' : ''}
            onClick={() => setMode('manual')}
          >
            Pay to a different account
          </button>
        </div>

        {mode === 'manual' && (
          <div className="admin-payout-manual">
            <label>
              Bank
              <select
                value={bankCode}
                disabled={busy}
                onChange={(event) => {
                  setBankCode(event.target.value);
                  setResolvedName(null);
                }}
              >
                <option value="">Select bank</option>
                {banks.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Account number
              <input
                inputMode="numeric"
                value={accountNumber}
                disabled={busy}
                placeholder="0123456789"
                onChange={(event) => {
                  setAccountNumber(event.target.value.replace(/[^\d]/g, '').slice(0, 10));
                  setResolvedName(null);
                }}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || !bankCode || !/^\d{10}$/.test(accountNumber)}
              onClick={() => void verifyAccount()}
            >
              {busy ? 'Checking…' : 'Verify account'}
            </button>
            {resolvedName && (
              <p className="admin-payout-resolved" role="status">
                Account name: <strong>{resolvedName}</strong>
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="prompt-dialog-message admin-payout-error" role="alert">
            {error}
          </p>
        )}

        <p className="prompt-dialog-message">
          If Paystack OTP for transfers is enabled, you will be asked to enter the OTP next. Funds
          stay held until the transfer is confirmed.
        </p>

        <div className="prompt-dialog-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          {mode === 'saved' ? (
            <button type="button" disabled={busy || thisRelease <= 0} onClick={() => void release(false)}>
              {busy
                ? 'Releasing…'
                : `${isFullRelease ? 'Pay artisan' : 'Send'} ${money(thisRelease)}`}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !manualReady || thisRelease <= 0}
              onClick={() => void release(true)}
            >
              {busy ? 'Releasing…' : `Confirm & send ${money(thisRelease)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}
