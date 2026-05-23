import type { Booking, PaymentStatus } from '../types';
import { locationFromBookingNote, timeSlotOptions } from './bookingRequest';

export function statusLabel(status: Booking['status']) {
  if (status === 'ONGOING') return 'in progress';
  if (status === 'ACCEPTED') return 'appointment';
  return status.toLowerCase().replace(/_/g, ' ');
}

export function customerBookingStatusLabel(status: Booking['status']) {
  switch (status) {
    case 'REQUESTED':
      return 'Pending';
    case 'ACCEPTED':
      return 'Accepted';
    case 'COMPLETED':
      return 'Completed';
    case 'DECLINED':
      return 'Declined';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

export function bookingCardDate(value: string | null) {
  if (!value) return 'Not scheduled';

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function bookingTimeSlotLabel(value: string | null) {
  if (!value) return 'To be confirmed';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'To be confirmed';
  }

  const hour = date.getHours();
  const minute = date.getMinutes();
  const match = timeSlotOptions.find((slot) => {
    const [slotHour, slotMinute] = slot.value.split(':').map(Number);
    return slotHour === hour && slotMinute === minute;
  });

  if (match) {
    return match.label;
  }

  if (hour < 12) return 'Morning (8am - 12pm)';
  if (hour < 17) return 'Afternoon (1pm - 4pm)';
  return 'Evening (5pm - 7pm)';
}

export function bookingCardLocation(booking: Booking) {
  const fallback = booking.artisan?.area || booking.offering?.artisan?.area || 'To be confirmed';
  return locationFromBookingNote(booking.note, fallback);
}

export function bookingCardNotes(note: string | null) {
  if (!note) return 'No note added';

  const withoutLocation = note.replace(/^Service location:\s*.+?(?:\n\n|$)/is, '').trim();
  return withoutLocation || 'No note added';
}

export function artisanExpertiseLabel(booking: Booking) {
  const category = booking.offering?.category?.name;

  if (!category) {
    return 'Service professional';
  }

  return category.toLowerCase().endsWith('expert') ? category : `${category} expert`;
}

export function paymentLabel(status?: PaymentStatus) {
  if (!status) return 'unpaid';
  return status.toLowerCase().replace(/_/g, ' ');
}

export function formatBookingConfirmedDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'To be confirmed';
  }

  const dayPart = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${dayPart} · ${timePart}`;
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
