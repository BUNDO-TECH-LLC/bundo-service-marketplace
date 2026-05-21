import { useState } from 'react';
import type { ActionRunner } from '../../appTypes';
import { api } from '../../lib/api';
import { BecomeArtisanButton } from './BecomeArtisanButton';
import type { ApiUser, NotificationPreferences } from '../../types';

const defaultPrefs: NotificationPreferences = {
  bookings: true,
  messages: true,
  marketing: false,
};

export function AccountSettingsPanel({
  token,
  me,
  busy,
  runAction,
  refresh,
  onBecomeArtisan = () => undefined,
}: {
  token: string;
  me: ApiUser;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  onBecomeArtisan?: () => void;
}) {
  const [phone, setPhone] = useState(me.phone || '');
  const [prefs, setPrefs] = useState<NotificationPreferences>(me.notificationPreferences || defaultPrefs);

  async function savePhone() {
    await api('/users/phone', {
      method: 'PATCH',
      token,
      body: JSON.stringify({ phone: phone.trim() }),
    });
    await refresh();
  }

  async function savePreferences() {
    await api('/users/notification-preferences', {
      method: 'PATCH',
      token,
      body: JSON.stringify(prefs),
    });
    await refresh();
  }

  return (
    <>
      <article className="panel-card form-card">
        <p className="eyebrow">Contact</p>
        <h2>Phone number</h2>
        <p className="muted">Used for booking updates and support. Include country code (e.g. +234…).</p>
        <label>
          Phone
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+2348012345678"
            autoComplete="tel"
          />
        </label>
        <button disabled={busy || !phone.trim()} onClick={() => runAction(savePhone, 'Phone number saved')}>
          Save phone
        </button>
      </article>

      <article className="panel-card">
        <p className="eyebrow">Notifications</p>
        <h2>Email and in-app alerts</h2>
        <p className="muted">Control which events generate notifications. Push alerts still require browser permission.</p>
        <label className="terms-row">
          <input
            type="checkbox"
            checked={prefs.bookings}
            onChange={(event) => setPrefs((current) => ({ ...current, bookings: event.target.checked }))}
          />{' '}
          <span>Booking updates (requests, acceptances, completions)</span>
        </label>
        <label className="terms-row">
          <input
            type="checkbox"
            checked={prefs.messages}
            onChange={(event) => setPrefs((current) => ({ ...current, messages: event.target.checked }))}
          />{' '}
          <span>New messages</span>
        </label>
        <label className="terms-row">
          <input
            type="checkbox"
            checked={prefs.marketing}
            onChange={(event) => setPrefs((current) => ({ ...current, marketing: event.target.checked }))}
          />{' '}
          <span>Product tips and marketplace highlights</span>
        </label>
        <button disabled={busy} onClick={() => runAction(savePreferences, 'Notification preferences saved')}>
          Save preferences
        </button>
      </article>

      <article className="panel-card">
        <p className="eyebrow">Profile settings</p>
        <h2>Account type</h2>
        <p>
          Current account: <strong>{me.role === 'ARTISAN' ? 'Artisan (verified)' : 'Client'}</strong>
        </p>
        {me.role === 'ARTISAN' ? (
          <p className="muted">
            You are a verified artisan. Manage your profile, offerings, and payouts from your workspace.
          </p>
        ) : me.role === 'ADMIN' ? (
          <p className="muted">Admin access is managed from the admin console.</p>
        ) : (
          <>
            <p className="muted">
              Every account starts as a client. To offer services on Bundo, complete artisan onboarding and identity
              verification. Your account switches to artisan only after admin approval.
            </p>
            <div className="actions">
              <BecomeArtisanButton me={me} busy={busy} onStart={onBecomeArtisan} />
            </div>
          </>
        )}
      </article>
    </>
  );
}
