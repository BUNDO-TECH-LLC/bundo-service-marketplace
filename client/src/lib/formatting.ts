export { dayLabels } from '../constants/data';

export function money(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatConversationPreviewTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = startOfDay(now);
  const messageDay = startOfDay(date);

  if (messageDay.getTime() === today.getTime()) {
    return formatMessageTime(value);
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
  }

  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function formatMessageDayLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = startOfDay(now);
  const messageDay = startOfDay(date);

  if (messageDay.getTime() === today.getTime()) {
    return 'Today';
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);
}
