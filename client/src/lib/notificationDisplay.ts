import type { Notification } from '../types';
import { bookingDate } from './bookingDisplay';

export function notificationTypeLabel(type: Notification['type']) {
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function relativeNotificationTime(value: string) {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(diffMs / (1000 * 60));

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);

  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour');
  }

  const days = Math.round(hours / 24);

  if (Math.abs(days) < 7) {
    return formatter.format(days, 'day');
  }

  return bookingDate(value);
}
