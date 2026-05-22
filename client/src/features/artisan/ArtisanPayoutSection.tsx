import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
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

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ banks: PayoutBank[] }>('/payments/banks', { token }),
    ])
      .then(([accountResponse, bankResponse]) => {
        if (!mounted) return;
        setPayoutAccount(accountResponse.account);
        setBanks(bankResponse.banks);
      })
      .catch(() => {
        if (mounted) {
          setPayoutAccount(null);
          setBanks([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function savePayoutAccount(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const selectedBank = banks.find((bank) => bank.code === String(form.get('bankCode') || ''));
    const accountNumber = String(form.get('accountNumber') || '')
      .replace(/\s+/g, '')
      .replace(/-/g, '');
    const response = await api<{ account: ProviderPayoutAccount }>('/artisans/payout-account', {
      method: 'POST',
      token,
      body: JSON.stringify({
        bankCode: String(form.get('bankCode') || '').trim(),
        bankName: selectedBank?.name,
        accountNumber,
        accountName: String(form.get('accountName') || '').trim() || undefined,
      }),
    });
    setPayoutAccount(response.account);
  }

  return (
    <form
      className="account-settings-form artisan-settings-card"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void runAction(() => savePayoutAccount(form), 'Payout account saved');
      }}
    >
      <h2>Payout bank account</h2>
      <p className="muted">
        Add the Nigerian bank account where approved completed-service payouts should be sent.
      </p>
      {payoutAccount && (
        <div className="payment-note success">
          <strong>{payoutAccount.accountName || 'Saved payout account'}</strong>
          <span>
            {payoutAccount.bankName || payoutAccount.bankCode} · ****{payoutAccount.accountNumber.slice(-4)}
          </span>
        </div>
      )}
      <label>
        Bank
        <select name="bankCode" defaultValue={payoutAccount?.bankCode || ''} required>
          <option value="" disabled>
            Select bank
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
        <input name="accountNumber" defaultValue={payoutAccount?.accountNumber || ''} required />
      </label>
      <label>
        Account name
        <input name="accountName" defaultValue={payoutAccount?.accountName || ''} />
      </label>
      <button type="submit" disabled={busy}>
        Save bank information
      </button>
    </form>
  );
}
