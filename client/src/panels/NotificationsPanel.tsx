import { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { api } from '../lib/api';
import { notificationTypeLabel, relativeNotificationTime } from '../lib/notificationDisplay';
import { resolveNotificationTarget } from '../lib/notificationNavigation';
import type { ActionRunner, PushStatus } from '../appTypes';
import type { Notification } from '../types';

export function NotificationsPanel({
  token,
  notifications,
  busy,
  runAction,
  refresh,
  onNavigate,
  pushStatus,
  pushEnabled = false,
  enablePushAlerts,
}: {
  token: string;
  notifications: Notification[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  onNavigate: (path: string) => void;
  pushStatus?: PushStatus;
  pushEnabled?: boolean;
  enablePushAlerts?: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const visibleNotifications =
    filter === 'unread' ? notifications.filter((notification) => !notification.readAt) : notifications;

  async function markRead(notificationId: string) {
    await api(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
      token,
    });
    await refresh();
  }

  function openNotification(notification: Notification) {
    const path = resolveNotificationTarget(notification);
    if (path) {
      onNavigate(path);
    }
    if (!notification.readAt) {
      void markRead(notification.id).catch(() => undefined);
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

  const showPushBanner = pushStatus !== undefined && enablePushAlerts !== undefined;

  return (
    <section className="notifications-page">
      <header className="notifications-page-head">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1>Notifications</h1>
          <p className="muted">Booking, payment, message, and account updates.</p>
        </div>
        {unreadCount > 0 && (
          <span className="notifications-unread-pill" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount} unread
          </span>
        )}
      </header>

      {showPushBanner ? (
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
                ? 'New booking, payment, and message activity can reach this browser even when you are away from the page.'
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
              onClick={() => void runAction(enablePushAlerts!, '')}
            >
              {pushEnabled ? 'Alerts enabled' : 'Enable push alerts'}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void runAction(sendTestNotification, 'Test notification sent')}
            >
              Send test notification
            </button>
          </div>
        </section>
      ) : null}

      <section className="notifications-shell">
        <div className="notifications-toolbar">
          <div className="notification-filter-tabs" role="tablist" aria-label="Notification filters">
            <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>
              All
            </button>
            <button className={filter === 'unread' ? 'active' : ''} type="button" onClick={() => setFilter('unread')}>
              Unread
            </button>
          </div>
          <button
            className="secondary-button notifications-mark-all"
            disabled={busy || unreadCount === 0}
            onClick={() => void runAction(markAllRead, 'All notifications marked as read')}
          >
            Mark all read
          </button>
        </div>

        {visibleNotifications.length === 0 ? (
          <EmptyState
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            body={
              filter === 'unread'
                ? 'You are all caught up for now.'
                : 'Activity from bookings, messages, and payments will appear here.'
            }
          />
        ) : (
          <ul className="notification-list">
            {visibleNotifications.map((notification) => {
              const targetPath = resolveNotificationTarget(notification);
              const isUnread = !notification.readAt;

              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notification-row${isUnread ? ' unread' : ''}${targetPath ? ' has-target' : ''}`}
                    disabled={busy}
                    onClick={() => openNotification(notification)}
                  >
                    <span className={`notification-row-dot${isUnread ? ' unread' : ''}`} aria-hidden="true" />
                    <span className="notification-row-main">
                      <span className="notification-row-meta">
                        <span className="notification-type-pill">{notificationTypeLabel(notification.type)}</span>
                        <time dateTime={notification.createdAt}>{relativeNotificationTime(notification.createdAt)}</time>
                      </span>
                      <span className="notification-row-title">{notification.title}</span>
                      {notification.body ? <span className="notification-row-body">{notification.body}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
