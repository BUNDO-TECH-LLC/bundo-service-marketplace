import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { api } from '../../lib/api';
import {
  readCustomerProfileLocation,
  readEmailNotificationsPreference,
  readLocationAccessPreference,
  writeEmailNotificationsPreference,
  writeLocationAccessPreference,
} from '../../lib/customerProfileStorage';
import { money } from '../../lib/formatting';
import { enableBrowserPush, ensureBrowserPushToken, hasPushConfig } from '../../lib/messaging';
import { userFullDisplayName } from '../../lib/userDisplayName';
import type { ApiUser, Booking } from '../../types';
import { AppIcon } from '../ui/AppIcon';

type CustomerSettingsScreenProps = {
  firebaseUser: User;
  me: ApiUser | null;
  onEditProfile: () => void;
  onViewAllBookings: () => void;
};

function formatBookingDate(value: string | null) {
  if (!value) {
    return 'Date pending';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatBookingStatus(status: Booking['status']) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function bookingAmount(booking: Booking) {
  if (booking.payment?.amount) {
    return money(booking.payment.amount);
  }

  if (booking.offering) {
    return money(booking.offering.priceTo ?? booking.offering.priceFrom);
  }

  return money(0);
}

type SettingsToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function SettingsToggle({ checked, disabled = false, label, onChange }: SettingsToggleProps) {
  return (
    <button
      className={`customer-settings-toggle${checked ? ' is-on' : ''}`}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="customer-settings-toggle__thumb" />
    </button>
  );
}

export function CustomerSettingsScreen({
  firebaseUser,
  me,
  onEditProfile,
  onViewAllBookings,
}: CustomerSettingsScreenProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(readEmailNotificationsPreference);
  const [locationAccess, setLocationAccess] = useState(readLocationAccessPreference);

  const fullName = userFullDisplayName(firebaseUser, me);
  const email = firebaseUser.email || me?.email || '—';
  const phone = me?.phone || '—';
  const location = readCustomerProfileLocation();
  const locationLabel = location ? `${location}, Nigeria` : '—';

  useEffect(() => {
    let cancelled = false;

    async function loadBookings() {
      setBookingsLoading(true);

      try {
        const token = await firebaseUser.getIdToken();
        const response = await api<{ bookings: Booking[] }>('/bookings/customer?page=1&limit=20', {
          token,
        });

        if (!cancelled) {
          setBookings(response.bookings);
        }
      } catch {
        if (!cancelled) {
          setBookings([]);
        }
      } finally {
        if (!cancelled) {
          setBookingsLoading(false);
        }
      }
    }

    void loadBookings();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadPushState() {
      if (!hasPushConfig()) {
        return;
      }

      const result = await ensureBrowserPushToken();

      if (!cancelled && result.status === 'enabled') {
        setPushEnabled(true);
      }
    }

    void loadPushState();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePushToggle(nextValue: boolean) {
    if (!nextValue) {
      try {
        const token = await firebaseUser.getIdToken();
        await api('/users/fcm-token', { method: 'DELETE', token });
      } catch {
        // Keep UI in sync even if token removal fails.
      }

      setPushEnabled(false);
      return;
    }

    setPushBusy(true);

    try {
      const result = await enableBrowserPush();

      if (result.status === 'enabled') {
        const token = await firebaseUser.getIdToken();
        await api('/users/fcm-token', {
          method: 'PATCH',
          token,
          body: JSON.stringify({ fcmToken: result.token }),
        });
        setPushEnabled(true);
      }
    } finally {
      setPushBusy(false);
    }
  }

  const recentBookings = bookings.slice(0, 3);

  return (
    <section className="customer-settings-screen" aria-labelledby="customer-settings-title">
      <header className="customer-settings-screen__head">
        <h1 id="customer-settings-title" className="customer-settings-screen__title">
          Account Settings
        </h1>
        <p className="customer-settings-screen__subtitle">
          Manage your personal profile and application preferences.
        </p>
      </header>

      <article className="customer-settings-card">
        <div className="customer-settings-card__header">
          <h2>Personal Information</h2>
          <button className="customer-settings-card__edit" type="button" onClick={onEditProfile}>
            <AppIcon icon="mdi:pencil-outline" size={18} />
            Edit
          </button>
        </div>

        <dl className="customer-settings-info-grid">
          <div>
            <dt>Full Name</dt>
            <dd>{fullName}</dd>
          </div>
          <div>
            <dt>Email Address</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>Phone Number</dt>
            <dd>{phone}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{locationLabel}</dd>
          </div>
        </dl>
      </article>

      <article className="customer-settings-card">
        <div className="customer-settings-card__header">
          <h2>Booking history</h2>
          <span className="customer-settings-card__meta">{bookings.length} total</span>
        </div>

        {bookingsLoading ? (
          <p className="customer-settings-card__empty">Loading bookings…</p>
        ) : recentBookings.length === 0 ? (
          <p className="customer-settings-card__empty">No bookings yet.</p>
        ) : (
          <ul className="customer-settings-bookings">
            {recentBookings.map((booking) => (
              <li key={booking.id} className="customer-settings-booking">
                <span className="customer-settings-booking__icon" aria-hidden="true">
                  <AppIcon icon="mdi:pencil-outline" size={20} />
                </span>
                <div className="customer-settings-booking__copy">
                  <strong>{booking.offering?.title || 'Custom service'}</strong>
                  <span>
                    {formatBookingDate(booking.scheduledAt)} • {formatBookingStatus(booking.status)}
                  </span>
                </div>
                <span className="customer-settings-booking__price">{bookingAmount(booking)}</span>
              </li>
            ))}
          </ul>
        )}

        {bookings.length > 0 ? (
          <button className="customer-settings-card__link" type="button" onClick={onViewAllBookings}>
            View all bookings
          </button>
        ) : null}

        <p className="customer-settings-card__footnote">Historical data is archived monthly.</p>
      </article>

      <article className="customer-settings-card">
        <h2 className="customer-settings-card__title-only">Preferences</h2>

        <ul className="customer-settings-preferences">
          <li>
            <div>
              <strong>Push Notifications</strong>
              <p>Receive real-time alerts about your bookings.</p>
            </div>
            <SettingsToggle
              checked={pushEnabled}
              disabled={pushBusy || !hasPushConfig()}
              label="Push notifications"
              onChange={(value) => {
                void handlePushToggle(value);
              }}
            />
          </li>
          <li>
            <div>
              <strong>Email Notifications</strong>
              <p>Weekly summaries and payment invoices.</p>
            </div>
            <SettingsToggle
              checked={emailNotifications}
              label="Email notifications"
              onChange={(value) => {
                setEmailNotifications(value);
                writeEmailNotificationsPreference(value);
              }}
            />
          </li>
          <li>
            <div>
              <strong>Location access</strong>
              <p>Used to find local artisans near your current area.</p>
            </div>
            <SettingsToggle
              checked={locationAccess}
              label="Location access"
              onChange={(value) => {
                setLocationAccess(value);
                writeLocationAccessPreference(value);
              }}
            />
          </li>
        </ul>
      </article>
    </section>
  );
}
