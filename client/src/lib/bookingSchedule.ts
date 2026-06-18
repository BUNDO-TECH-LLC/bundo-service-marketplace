import type { AvailabilitySlot } from '../types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function todayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function bookingFitsAvailability(scheduledAt: Date, slots: AvailabilitySlot[]) {
  const activeSlots = slots.filter((slot) => slot.isActive);

  if (!activeSlots.length) {
    return true;
  }

  const dayOfWeek = scheduledAt.getDay();
  const minuteOfDay = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();

  return activeSlots.some((slot) => {
    if (slot.dayOfWeek !== dayOfWeek) {
      return false;
    }

    const start = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);
    return minuteOfDay >= start && minuteOfDay < end;
  });
}

export function buildTimeOptionsForDate(date: string, slots: AvailabilitySlot[]) {
  if (!date) {
    return [];
  }

  const activeSlots = slots.filter((slot) => slot.isActive);
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const daySlots = activeSlots.filter((slot) => slot.dayOfWeek === dayOfWeek);

  if (!activeSlots.length) {
    return ['09:00', '13:00', '17:00'];
  }

  if (!daySlots.length) {
    return [];
  }

  const options: string[] = [];

  for (const slot of daySlots) {
    const start = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);

    for (let minute = start; minute < end; minute += 60) {
      const hours = String(Math.floor(minute / 60)).padStart(2, '0');
      const minutes = String(minute % 60).padStart(2, '0');
      options.push(`${hours}:${minutes}`);
    }
  }

  return [...new Set(options)].sort();
}

export function validateBookingDateTime(date: string, time: string, slots: AvailabilitySlot[]) {
  if (!date || !time) {
    return 'Choose a date and time for your booking.';
  }

  const scheduledAt = new Date(`${date}T${time}:00`);

  if (Number.isNaN(scheduledAt.getTime())) {
    return 'Enter a valid date and time.';
  }

  if (scheduledAt.getTime() <= Date.now()) {
    return 'Choose a date and time in the future.';
  }

  if (!bookingFitsAvailability(scheduledAt, slots)) {
    return 'This time is outside the artisan’s available hours. Pick another slot.';
  }

  return null;
}

export function formatAvailabilityHint(slots: AvailabilitySlot[]) {
  const active = slots.filter((slot) => slot.isActive);
  if (!active.length) {
    return 'Flexible hours — morning, afternoon, or evening slots are available.';
  }

  const sample = active
    .slice(0, 3)
    .map((slot) => `${DAY_LABELS[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}`)
    .join(', ');

  return `Available: ${sample}${active.length > 3 ? '…' : ''}`;
}
