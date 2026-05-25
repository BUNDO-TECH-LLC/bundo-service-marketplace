import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { ActionRunner } from '../../appTypes';
import type { PayoutBank, ProviderPayoutAccount } from '../../types';

export function ArtisanPayoutSection({
  token,
  busy,
  runAction,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
}) {
  const [payoutAccount, setPayoutAccount] = useState<ProviderPayoutAccount | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadPayoutSettings() {
      const [accountResult, bankResult] = await Promise.allSettled([
        api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
        api<{ banks: PayoutBank[] }>('/payments/banks', { token }),
      ]);

      if (!mounted) return;

      if (accountResult.status === 'fulfilled') {
        setPayoutAccount(accountResult.value.account);
        setEditing(!accountResult.value.account);
      } else {
        setPayoutAccount(null);
      }

      if (bankResult.status === 'fulfilled') {
        setBanks(bankResult.value.banks);
        setLoadError('');
      } else {
        setBanks([]);
        const message =
          bankResult.reason instanceof ApiError
            ? bankResult.reason.message
            : 'Could not load banks right now. Refresh and try again.';
        setLoadError(message);
      }
    }

    void loadPayoutSettings();

    return () => {
      mounted = false;
    };
  }, [token]);

  async function savePayoutAccount(formElement: HTMLFormElement) {
    setSaveError('');
    const form = new FormData(formElement);
    const bankCode = String(form.get('bankCode') || '').trim();
    const selectedBank = banks.find((bank) => bank.code === bankCode);
    const accountNumber = String(form.get('accountNumber') || '')
      .replace(/\s+/g, '')
      .replace(/-/g, '');

    if (!selectedBank) {
      throw new Error('Select a bank from the list before saving payout details.');
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      throw new Error('Account number must be exactly 10 digits.');
    }

    try {
      const response = await api<{ account: ProviderPayoutAccount }>('/artisans/payout-account', {
        method: 'POST',
        token,
        body: JSON.stringify({
          bankCode,
          bankName: selectedBank.name,
          accountNumber,
          accountName: String(form.get('accountName') || '').trim() || undefined,
        }),
      });
      setPayoutAccount(response.account);
      setEditing(false);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not save payout account. Try again.';
      setSaveError(message);
      throw new Error(message);
    }
  }

  const canEdit = editing || !payoutAccount;

  return (
    <section className="account-settings-form artisan-settings-card">
      <h2>Payout bank account</h2>
      <p className="muted">
        Add the Nigerian bank account where approved completed-service payouts should be sent. Use a
        10-digit account number with no spaces.
      </p>
      {loadError && <p className="auth-field-error">{loadError}</p>}
      {payoutAccount && (
        <div className="payment-note success">
          <strong>{payoutAccount.accountName || 'Saved payout account'}</strong>
          <span>
            {payoutAccount.bankName || payoutAccount.bankCode} · ****{payoutAccount.accountNumber.slice(-4)}
          </span>
          {!canEdit && (
            <button
              type="button"
              className="text-button payout-change-button"
              onClick={() => {
                setEditing(true);
                setSaveError('');
              }}
            >
              Change payout account
            </button>
          )}
        </div>
      )}

      {canEdit && (
        <form
          className="account-settings-form payout-account-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void runAction(() => savePayoutAccount(form), 'Payout account saved');
          }}
        >
          {saveError && <p className="auth-field-error">{saveError}</p>}
          <label>
            Bank
            <select
              name="bankCode"
              defaultValue={payoutAccount?.bankCode || ''}
              disabled={busy || banks.length === 0}
              required
            >
              <option value="" disabled>
                {banks.length ? 'Select bank' : 'Banks unavailable'}
              </option>
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
              name="accountNumber"
              defaultValue={payoutAccount?.accountNumber || ''}
              inputMode="numeric"
              pattern="\d{10}"
              maxLength={10}
              placeholder="0123456789"
              required
            />
          </label>
          <label>
            Account name
            <input
              name="accountName"
              defaultValue={payoutAccount?.accountName || ''}
              placeholder="Name on bank account"
            />
          </label>
          <button type="submit" disabled={busy || banks.length === 0}>
            Save bank information
          </button>
        </form>
      )}
    </section>
  );
}
