import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { nigeriaStates } from '../lib/geo';
import { useAppRoot } from '../app/appRootContext';
import type { ApiUser } from '../types';

export default function CustomerProfilePage() {
  const ctx = useAppRoot();
  const email = ctx.firebaseUser?.email || ctx.me?.email || '';
  const [phone, setPhone] = useState(ctx.me?.phone?.replace(/^\+234/, '') || '');
  const [state, setState] = useState(ctx.me?.state || '');
  const [area, setArea] = useState(ctx.me?.area || '');
  const [address, setAddress] = useState(ctx.me?.address || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const normalizedPhone = phone.trim().startsWith('+')
      ? phone.trim()
      : `+234${phone.replace(/\D/g, '')}`;

    if (!normalizedPhone || normalizedPhone.length < 12) {
      setError('Enter a valid Nigerian phone number.');
      return;
    }

    if (!state.trim()) {
      setError('Select your state.');
      return;
    }

    if (!area.trim()) {
      setError('Enter your area or city.');
      return;
    }

    setBusy(true);

    try {
      const response = await api<{ user: ApiUser }>('/users/profile', {
        method: 'PATCH',
        token: ctx.token,
        body: JSON.stringify({
          phone: normalizedPhone,
          state: state.trim(),
          area: area.trim(),
          address: address.trim() || undefined,
        }),
      });

      ctx.acknowledgeSession(ctx.token, response.user);
      ctx.setNotice('Profile saved. Welcome to Bundo!');
      ctx.navigate('/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page customer-profile-page">
      <section className="customer-profile-card">
        <p className="eyebrow">Almost there</p>
        <h1>Complete your profile</h1>
        <p className="muted">
          Tell us how to reach you and where you need services so we can show relevant artisans nearby.
        </p>

        <form className="customer-profile-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Email
            <input type="email" value={email} readOnly disabled />
          </label>

          <label>
            Phone number
            <div className="phone-input">
              <span aria-hidden="true">+234</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="8012345678"
                autoComplete="tel"
                required
              />
            </div>
          </label>

          <label>
            State
            <select value={state} onChange={(event) => setState(event.target.value)} required>
              <option value="">Select state</option>
              {nigeriaStates.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Area / city
            <input
              value={area}
              onChange={(event) => setArea(event.target.value)}
              placeholder="e.g. Lekki, Wuse, GRA"
              required
            />
          </label>

          <label>
            Address <span className="muted">(optional)</span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Street or landmark to help artisans find you"
              rows={3}
              maxLength={200}
            />
          </label>

          {error && <p className="auth-field-error">{error}</p>}

          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </section>
    </main>
  );
}
