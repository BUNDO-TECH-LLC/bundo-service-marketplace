import { api } from './api';
import type { Booking } from '../types';

export const timeSlotOptions = [
  { value: '08:00', label: 'Morning (8am - 12pm)' },
  { value: '13:00', label: 'Afternoon (1pm - 4pm)' },
  { value: '17:00', label: 'Evening (5pm - 7pm)' },
] as const;

export function buildScheduledAt(date: string, timeSlot: string) {
  return new Date(`${date}T${timeSlot}:00`).toISOString();
}

export function estimateServiceFee(priceFrom: number) {
  return Math.round(priceFrom * 0.1);
}

export function defaultBookingLocation(area?: string | null, city?: string | null) {
  const parts = [area, city].filter(Boolean);

  if (parts.length === 0) {
    return 'Lagos, Nigeria';
  }

  const joined = parts.join(', ');
  return joined.includes('Nigeria') ? joined : `${joined}, Nigeria`;
}

export function locationFromBookingNote(note: string | null | undefined, fallback: string) {
  if (!note) {
    return fallback;
  }

  const match = note.match(/Service location:\s*(.+?)(?:\n\n|$)/is);
  return match?.[1]?.trim() || fallback;
}

export async function createBookingRequest(input: {
  token: string;
  offeringId: string;
  scheduledAt: string;
  note: string;
}) {
  return api<{ booking: Booking }>('/bookings', {
    method: 'POST',
    token: input.token,
    body: JSON.stringify({
      offeringId: input.offeringId,
      scheduledAt: input.scheduledAt,
      note: input.note,
    }),
  });
}
