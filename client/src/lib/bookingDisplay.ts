import type { Booking, PaymentStatus } from '../types';

export function statusLabel(status: Booking['status']) {
  return status.toLowerCase().replace(/_/g, ' ');
}

export function paymentLabel(status?: PaymentStatus) {
  if (!status) return 'unpaid';
  return status.toLowerCase().replace(/_/g, ' ');
}

export function bookingDate(value: string | null) {
  if (!value) return 'Not scheduled';

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function bookingInputValue(value: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function parseBookingInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function bookingContactName(booking: Booking) {
  return booking.customerUser?.email?.split('@')[0] || 'Customer';
}

export function bookingLocation(booking: Booking) {
  return booking.artisan?.area || booking.offering?.artisan?.area || 'Lagos';
}
