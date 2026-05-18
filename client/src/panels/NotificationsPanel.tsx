import { useState } from 'react';
import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import { normalizeNotificationLink } from '../lib/notificationNavigation';
import { notificationTypeLabel, relativeNotificationTime } from '../lib/notificationDisplay';
import type { ActionRunner, PushStatus } from '../appTypes';
import type { Notification } from '../types';
import { EmptyState } from '../components/EmptyState';

export function NotificationsPanel({
  token,
  notifications,
  busy,
  runAction,
  refresh,
  pushStatus,
  pushEnabled,
  enablePushAlerts,
  onNavigate,
}: {
  token: string;
  notifications: Notification[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  pushStatus: PushStatus;
  pushEnabled: boolean;
  enablePushAlerts: () => Promise<void>;
  onNavigate: (path: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  async function markRead(notificationId: string) {
    await api(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
      token,
    });
    await refresh();
  }

  async function openNotification(notification: Notification) {
    if (!notification.readAt) {
      await markRead(notification.id);
    }
    const path = normalizeNotificationLink(notification.link);
    if (path) {
      onNavigate(path);
    }
  }

  async function markAllRead() {
    await api('/notifications/read-all', {
      method: 'PATCH',
      token,
    });
    await refresh();
  }

  async function sendTestNotification() {
    await api('/notifications/test', {
      method: 'POST',
      token,
    });
    await refresh();
  }

  const isProduction = import.meta.env.PROD;
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const visibleNotifications =
    filter === 'unread' ? notifications.filter((notification) => !notification.readAt) : notifications;

  function isCardInteractive(notification: Notification, targetPath: string | null) {
    return Boolean(targetPath) || !notification.readAt;
  }

  async function handleCardActivate(notification: Notification, targetPath: string | null) {
    if (targetPath) {
      await openNotification(notification);
      return;
    }
    if (!notification.readAt) {
      await markRead(notification.id);
    }
  }

  return (
    <section className="notifications-page">
      <header className="notifications-hero">
        <div className="notifications-hero-copy">
          <p className="eyebrow">Notifications</p>
          <h2>Stay on top of bookings, messages, payments, and reviews</h2>
          <p>
            Everything important to your account lands here first, with browser alerts available when you want faster
            updates.
          </p>
        </div>
        <div className="notifications-summary-grid">
          <article className="notification-summary-card">
            <span>Total</span>
            <strong>{notifications.length}</strong>
            <small>Recent activity in your workspace</small>
          </article>
          <article className="notification-summary-card accent">
            <span>Unread</span>
            <strong>{unreadCount}</strong>
            <small>New items waiting for you</small>
          </article>
        </div>
      </header>

      <section className={`push-banner ${pushEnabled ? 'enabled' : ''}`}>
        <div className="push-banner-copy">
          <p className="eyebrow">Browser alerts</p>
          <h3>
            {pushEnabled
              ? 'Browser alerts are active'
              : pushStatus === 'missing-config'
                ? 'Push alerts need one more Firebase setting'
                : pushStatus === 'denied'
                  ? 'Browser notifications are blocked for this site'
                  : 'Turn on push alerts for real-time updates'}
          </h3>
          <p>
            {pushEnabled
              ? 'New booking, payment, and message activity can now reach this browser even when you are away from the page.'
              : pushStatus === 'missing-config'
                ? 'Add VITE_FIREBASE_VAPID_KEY in the client environment to finish web push setup.'
                : pushStatus === 'unsupported'
                  ? 'This browser does not support Firebase web push for the current environment.'
                  : pushStatus === 'denied'
                    ? 'Re-enable notifications in your browser site settings, then come back here.'
                    : 'Enable alerts to get a visible heads-up without needing to keep the notifications page open.'}
          </p>
        </div>
        <div className="push-banner-actions">
          <button
            className={pushEnabled ? 'secondary-button' : 'primary-button'}
            disabled={busy || pushEnabled || pushStatus === 'denied' || pushStatus === 'missing-config'}
            onClick={() => runAction(enablePushAlerts, '')}
          >
            {pushEnabled ? 'Alerts enabled' : 'Enable push alerts'}
          </button>
          {!isProduction && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => runAction(sendTestNotification, 'Test notification sent')}
            >
              Send test notification
            </button>
          )}
        </div>
      </section>

      <section className="notifications-shell">
        <div className="notifications-toolbar">
          <div className="notification-filter-tabs" role="tablist" aria-label="Notification filters">
            <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>
              All activity
            </button>
            <button className={filter === 'unread' ? 'active' : ''} type="button" onClick={() => setFilter('unread')}>
              Unread
            </button>
          </div>
          <button
            className="secondary-button"
            disabled={busy || unreadCount === 0}
            onClick={() => runAction(markAllRead, 'All notifications marked as read')}
          >
            Mark all as read
          </button>
        </div>

        {visibleNotifications.length === 0 ? (
          <EmptyState
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            body={
              filter === 'unread'
                ? 'You are all caught up for now.'
                : 'Booking, payment, chat, review, and admin events will appear here.'
            }
          />
        ) : (
          <div className="notification-list">
            {visibleNotifications.map((notification) => {
              const targetPath = normalizeNotificationLink(notification.link);
              const interactive = isCardInteractive(notification, targetPath);
              return (
              <article
                className={`notification-card ${notification.readAt ? 'read' : 'unread'}${interactive ? ' notification-card-clickable' : ''}`}
                key={notification.id}
                role={interactive ? (targetPath ? 'link' : 'button') : undefined}
                tabIndex={interactive && !busy ? 0 : undefined}
                aria-label={
                  targetPath
                    ? `${notification.title}. Open notification.`
                    : !notification.readAt
                      ? `${notification.title}. Mark as read.`
                      : undefined
                }
                onClick={
                  interactive && !busy
                    ? () => void runAction(() => handleCardActivate(notification, targetPath), '')
                    : undefined
                }
                onKeyDown={
                  interactive && !busy
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void runAction(() => handleCardActivate(notification, targetPath), '');
                        }
                      }
                    : undefined
                }
              >
                <div className={`notification-dot ${notification.readAt ? 'read' : 'unread'}`} aria-hidden="true" />
                <div className="notification-copy">
                  <div className="notification-meta">
                    <span className="notification-type-pill">{notificationTypeLabel(notification.type)}</span>
                    <small>{relativeNotificationTime(notification.createdAt)}</small>
                  </div>
                  <h3>{notification.title}</h3>
                  <p>{notification.body}</p>
                  <small>{bookingDate(notification.createdAt)}</small>
                </div>
                <div className="notification-card-actions">
                  {targetPath ? (
                    <span className="notification-open-hint">Tap to open</span>
                  ) : null}
                  {!notification.readAt ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        void runAction(() => markRead(notification.id), 'Notification marked as read');
                      }}
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="notification-read-label">Read</span>
                  )}
                </div>
              </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
