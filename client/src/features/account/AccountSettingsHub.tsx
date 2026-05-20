import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOut, updateProfile, verifyBeforeUpdateEmail } from 'firebase/auth';
import { buildAppPath } from '../../lib/appPaths';
import { api } from '../../lib/api';
import { sendBundoPasswordResetEmail } from '../../lib/authEmailVerification';
import { auth } from '../../lib/firebase';
import {
  LOCALE_OPTIONS,
  readLocalePreference,
  saveLocalePreference,
  type BundoLocale,
} from '../../lib/localePreference';
import { userDisplayName } from '../../lib/userDisplayName';
import { ArtisanKycSection } from '../artisan/ArtisanKycSection';
import { ArtisanPayoutSection } from '../artisan/ArtisanPayoutSection';
import type { AccountSettingsSection, ActionRunner } from '../../appTypes';
import type { ApiUser, Artisan, NotificationPreferences } from '../../types';

const defaultPrefs: NotificationPreferences = {
  bookings: true,
  messages: true,
  marketing: false,
};

const SETTINGS_NAV: {
  id: AccountSettingsSection;
  label: string;
  artisanOnly?: boolean;
  adminHidden?: boolean;
}[] = [
  { id: 'personal', label: 'Personal details' },
  { id: 'verification', label: 'Identity verification (KYC)', artisanOnly: true },
  { id: 'payouts', label: 'Payout bank account', artisanOnly: true },
  { id: 'phone', label: 'Change phone number' },
  { id: 'email', label: 'Change email' },
  { id: 'language', label: 'Change language' },
  { id: 'notifications', label: 'Manage notifications' },
  { id: 'password', label: 'Change password' },
  { id: 'delete', label: 'Delete my account permanently', adminHidden: true },
];

function isAccountSettingsSection(value: string): value is AccountSettingsSection {
  return SETTINGS_NAV.some((item) => item.id === value);
}

const SETTINGS_NAV_SHORT: Record<AccountSettingsSection, string> = {
  personal: 'Personal',
  verification: 'KYC',
  payouts: 'Bank',
  phone: 'Phone',
  email: 'Email',
  language: 'Language',
  notifications: 'Alerts',
  password: 'Password',
  delete: 'Delete',
};

const ARTISAN_SETTINGS_ORDER: AccountSettingsSection[] = [
  'verification',
  'payouts',
  'personal',
  'phone',
  'email',
  'language',
  'notifications',
  'password',
  'delete',
];

const ARTISAN_SETTINGS_LABELS: Record<AccountSettingsSection, string> = {
  personal: 'Personal details',
  verification: 'Identity verification',
  payouts: 'Payout bank account',
  phone: 'Contact phone',
  email: 'Login email',
  language: 'Language',
  notifications: 'Job & message alerts',
  password: 'Password',
  delete: 'Delete account',
};

export function AccountSettingsHub({
  token,
  me,
  firebaseUser,
  busy,
  runAction,
  refresh,
  onNavigate,
  onNotice,
}: {
  token: string;
  me: ApiUser;
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  onNavigate: (path: string) => void;
  onNotice: (message: string) => void;
}) {
  const isArtisan = me.role === 'ARTISAN';
  const [activeSection, setActiveSection] = useState<AccountSettingsSection>(isArtisan ? 'verification' : 'personal');
  const [fullName, setFullName] = useState(userDisplayName(firebaseUser, me));
  const [phone, setPhone] = useState(me.phone || '');
  const [newEmail, setNewEmail] = useState('');
  const [locale, setLocale] = useState<BundoLocale>(() => readLocalePreference());
  const [prefs, setPrefs] = useState<NotificationPreferences>(me.notificationPreferences || defaultPrefs);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [artisanProfile, setArtisanProfile] = useState<Artisan | null>(null);

  const navItems = useMemo(() => {
    const filtered = SETTINGS_NAV.filter((item) => {
      if (item.artisanOnly && me.role !== 'ARTISAN') return false;
      if (item.adminHidden && me.role === 'ADMIN') return false;
      return true;
    });

    if (me.role !== 'ARTISAN') {
      return filtered;
    }

    return ARTISAN_SETTINGS_ORDER.map((id) => filtered.find((item) => item.id === id))
      .filter((item): item is (typeof filtered)[number] => Boolean(item))
      .map((item) => ({
        ...item,
        label: ARTISAN_SETTINGS_LABELS[item.id],
      }));
  }, [me.role]);

  const activeNavLabel = navItems.find((item) => item.id === activeSection)?.label ?? 'Settings';

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && isAccountSettingsSection(hash) && navItems.some((item) => item.id === hash)) {
      setActiveSection(hash);
    }
  }, [navItems]);

  useEffect(() => {
    setFullName(userDisplayName(firebaseUser, me));
    setPhone(me.phone || '');
    setPrefs(me.notificationPreferences || defaultPrefs);
  }, [firebaseUser, me]);

  useEffect(() => {
    if (me.role !== 'ARTISAN') {
      return;
    }

    let cancelled = false;
    void api<{ profile: Artisan }>('/artisans/me', { token })
      .then((response) => {
        if (!cancelled) {
          setArtisanProfile(response.profile || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtisanProfile(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [me.role, token]);

  function selectSection(section: AccountSettingsSection) {
    setActiveSection(section);
    window.location.hash = section;
    document.getElementById(`account-settings-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function savePersonalDetails(event: FormEvent) {
    event.preventDefault();
    if (!firebaseUser) {
      onNotice('Sign in again to update your profile.');
      return;
    }

    const trimmed = fullName.trim();
    if (!trimmed) {
      onNotice('Enter your name.');
      return;
    }

    await updateProfile(firebaseUser, { displayName: trimmed });
    onNotice('Personal details updated.');
  }

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

  async function saveLanguage() {
    saveLocalePreference(locale);
    onNotice('Language preference saved. More translations are coming soon.');
  }

  async function sendEmailChangeLink() {
    if (!firebaseUser) {
      onNotice('Sign in again to change your email.');
      return;
    }

    const trimmed = newEmail.trim();
    if (!trimmed) {
      onNotice('Enter your new email address.');
      return;
    }

    await verifyBeforeUpdateEmail(firebaseUser, trimmed, {
      url: `${window.location.origin}/workspace/settings#email`,
    });
    onNotice('Verification link sent. Open it from your new inbox to finish updating your email.');
    setNewEmail('');
  }

  async function sendPasswordReset() {
    const email = firebaseUser?.email || me.email;
    if (!email) {
      onNotice('No email on file. Contact support to reset your password.');
      return;
    }

    await sendBundoPasswordResetEmail(email);
    onNotice('Password reset link sent. Check your inbox and spam folder.');
  }

  async function deleteAccount() {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      onNotice('Type DELETE to confirm permanent account removal.');
      return;
    }

    await api('/users/account', {
      method: 'DELETE',
      token,
      body: JSON.stringify({ confirm: 'DELETE' }),
    });

    onNotice('Your account has been permanently deleted.');
    if (auth) {
      await signOut(auth);
    }
    onNavigate('/');
  }

  function panelClass(section: AccountSettingsSection) {
    return `account-settings-panel${activeSection === section ? ' is-active' : ''}`;
  }

  return (
    <section className={`account-settings-page${isArtisan ? ' account-settings-page--artisan' : ''}`}>
      <header className="account-settings-hero">
        <div>
          <p className="eyebrow">{isArtisan ? 'Artisan account' : 'Account'}</p>
          <h1>Settings</h1>
          <p className="muted">
            {isArtisan
              ? 'Verification, payouts, contact details, security, and alerts for your artisan account.'
              : 'Manage your personal information, security, and notification preferences.'}
          </p>
          {isArtisan && artisanProfile && (
            <p className="account-settings-artisan-identity">
              <strong>{artisanProfile.displayName}</strong>
              <span className="account-settings-artisan-status">{artisanProfile.verifyStatus.toLowerCase()}</span>
              <button
                type="button"
                className="text-button account-settings-profile-link"
                onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'profile' }))}
              >
                Edit public profile
              </button>
            </p>
          )}
        </div>
      </header>

      <div className="account-settings-layout">
        <nav className="account-settings-nav" aria-label={isArtisan ? 'Artisan account settings' : 'Settings sections'}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeSection === item.id ? 'active' : ''}
              aria-current={activeSection === item.id ? 'true' : undefined}
              onClick={() => selectSection(item.id)}
            >
              <span className="account-settings-nav-label-full">{item.label}</span>
              <span className="account-settings-nav-label-short">{SETTINGS_NAV_SHORT[item.id]}</span>
            </button>
          ))}
        </nav>

        <p className="account-settings-mobile-heading" aria-live="polite">
          {activeNavLabel}
        </p>

        <div className="account-settings-panels">
          {me.role === 'ARTISAN' && (
            <article id="account-settings-verification" className={`panel-card form-card ${panelClass('verification')}`}>
              <ArtisanKycSection
                token={token}
                busy={busy}
                runAction={runAction}
                refresh={refresh}
                profileCity={artisanProfile?.city}
              />
            </article>
          )}

          {me.role === 'ARTISAN' && (
            <article id="account-settings-payouts" className={`panel-card form-card ${panelClass('payouts')}`}>
              <ArtisanPayoutSection token={token} busy={busy} runAction={runAction} />
            </article>
          )}

          <article id="account-settings-personal" className={`panel-card form-card ${panelClass('personal')}`}>
            <h2>Personal details</h2>
            <p className="muted">
              {isArtisan
                ? 'Your name appears on job updates, customer chats, and your Bundo artisan account.'
                : 'Your name appears on bookings, messages, and your account menu.'}
            </p>
            <form className="account-settings-form" onSubmit={(event) => void runAction(() => savePersonalDetails(event), 'Personal details saved')}>
              <label>
                Full name
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Account email
                <input type="email" value={me.email || firebaseUser?.email || ''} disabled />
              </label>
              <p className="muted account-settings-hint">
                To change your login email, use <strong>Change email</strong> in the menu.
              </p>
              <button type="submit" disabled={busy}>
                Save personal details
              </button>
            </form>
          </article>

          <article id="account-settings-phone" className={`panel-card form-card ${panelClass('phone')}`}>
            <h2>{isArtisan ? 'Contact phone' : 'Change phone number'}</h2>
            <p className="muted">
              {isArtisan
                ? 'Customers and Bundo support use this number for your jobs. Include country code (e.g. +234…).'
                : 'Used for booking updates and support. Include country code (e.g. +234…).'}
            </p>
            <label>
              Phone number
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+2348012345678"
                autoComplete="tel"
              />
            </label>
            <button type="button" disabled={busy || !phone.trim()} onClick={() => void runAction(savePhone, 'Phone number saved')}>
              Save phone number
            </button>
          </article>

          <article id="account-settings-email" className={`panel-card form-card ${panelClass('email')}`}>
            <h2>Change email</h2>
            <p className="muted">
              Current email: <strong>{me.email || firebaseUser?.email || 'Not set'}</strong>
            </p>
            <p className="muted account-settings-hint">
              We will send a verification link to your new address. You must open that link while signed in to finish
              the change.
            </p>
            <label>
              New email address
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <button type="button" disabled={busy || !newEmail.trim()} onClick={() => void runAction(sendEmailChangeLink, '')}>
              Send verification link
            </button>
          </article>

          <article id="account-settings-language" className={`panel-card form-card ${panelClass('language')}`}>
            <h2>Change language</h2>
            <p className="muted">Choose your preferred language. Full translations are rolling out across Bundo.</p>
            <label>
              Language
              <select value={locale} onChange={(event) => setLocale(event.target.value as BundoLocale)}>
                {LOCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => void runAction(saveLanguage, 'Language preference saved')}>
              Save language
            </button>
          </article>

          <article id="account-settings-notifications" className={`panel-card ${panelClass('notifications')}`}>
            <h2>{isArtisan ? 'Job & message alerts' : 'Manage notifications'}</h2>
            <p className="muted">
              {isArtisan
                ? 'Choose which job and account events send in-app and email alerts to you.'
                : 'Control which events generate in-app and email alerts.'}
            </p>
            <label className="terms-row">
              <input
                type="checkbox"
                checked={prefs.bookings}
                onChange={(event) => setPrefs((current) => ({ ...current, bookings: event.target.checked }))}
              />
              <span>
                {isArtisan
                  ? 'Job updates (new requests, acceptances, service start, completion, payouts)'
                  : 'Booking updates (requests, acceptances, completions)'}
              </span>
            </label>
            <label className="terms-row">
              <input
                type="checkbox"
                checked={prefs.messages}
                onChange={(event) => setPrefs((current) => ({ ...current, messages: event.target.checked }))}
              />
              <span>{isArtisan ? 'Customer messages on your jobs' : 'New messages'}</span>
            </label>
            <label className="terms-row">
              <input
                type="checkbox"
                checked={prefs.marketing}
                onChange={(event) => setPrefs((current) => ({ ...current, marketing: event.target.checked }))}
              />
              <span>
                {isArtisan
                  ? 'Tips for growing your Bundo business and marketplace updates'
                  : 'Product tips and marketplace highlights'}
              </span>
            </label>
            <button type="button" disabled={busy} onClick={() => void runAction(savePreferences, 'Notification preferences saved')}>
              Save notification preferences
            </button>
          </article>

          <article id="account-settings-password" className={`panel-card ${panelClass('password')}`}>
            <h2>Change password</h2>
            <p className="muted">
              We will email a secure reset link to <strong>{me.email || firebaseUser?.email || 'your address'}</strong>.
              Follow the link to choose a new password.
            </p>
            <button type="button" disabled={busy} onClick={() => void runAction(sendPasswordReset, 'Password reset email sent')}>
              Email me a reset link
            </button>
          </article>

          <article id="account-settings-delete" className={`panel-card account-settings-danger ${panelClass('delete')}`}>
            <h2>Delete my account permanently</h2>
            <p className="muted">
              {isArtisan
                ? 'This removes your artisan account and signs you out. Your public listing will be withdrawn. Jobs, payouts, and messages may be retained where required for legal or dispute records.'
                : 'This removes your Bundo account and signs you out. Bookings and messages may be retained where required for legal or dispute records.'}
            </p>
            <label>
              Type <strong>DELETE</strong> to confirm
              <input
                type="text"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="danger-button"
              disabled={busy || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
              onClick={() => void runAction(deleteAccount, '')}
            >
              Delete my account permanently
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}
