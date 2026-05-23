import { api } from './api';
import { dayLabels } from '../constants/data';
import type { AvailabilitySlot } from '../types';

export const DEFAULT_START_TIME = '08:00';
export const DEFAULT_END_TIME = '12:00';
export const WEEKDAY_DAY_NUMBERS = [1, 2, 3, 4, 5] as const;

export const ONBOARDING_WEEKDAYS = [
  { label: 'M', dayOfWeek: 1, fullName: dayLabels[1] },
  { label: 'T', dayOfWeek: 2, fullName: dayLabels[2] },
  { label: 'W', dayOfWeek: 3, fullName: dayLabels[3] },
  { label: 'T', dayOfWeek: 4, fullName: dayLabels[4] },
  { label: 'F', dayOfWeek: 5, fullName: dayLabels[5] },
  { label: 'S', dayOfWeek: 6, fullName: dayLabels[6] },
  { label: 'S', dayOfWeek: 0, fullName: dayLabels[0] },
] as const;

export type TimeRange = {
  startTime: string;
  endTime: string;
};

export type DaySchedule = TimeRange & {
  dayOfWeek: number;
};

export function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isValidTimeRange(startTime: string, endTime: string) {
  return minutesFromTime(endTime) > minutesFromTime(startTime);
}

export function formatTime12h(time24: string) {
  const [hours, minutes] = time24.split(':').map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time24;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')}${period}`;
}

export function parseTime12h(input: string) {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, '');

  const twelveHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);

  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1]);
    const minute = twelveHourMatch[2];
    const period = twelveHourMatch[3];

    if (hour < 1 || hour > 12) {
      return null;
    }

    if (period === 'PM' && hour !== 12) {
      hour += 12;
    }

    if (period === 'AM' && hour === 12) {
      hour = 0;
    }

    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);

  if (!twentyFourHourMatch) {
    return null;
  }

  const hour = Number(twentyFourHourMatch[1]);
  const minute = twentyFourHourMatch[2];

  if (hour < 0 || hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${minute}`;
}

export function hydrateScheduleFromSlots(slots: AvailabilitySlot[]) {
  if (slots.length === 0) {
    return {
      selectedDays: [...WEEKDAY_DAY_NUMBERS],
      sameHoursForAllDays: true,
      sharedHours: { startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
      perDayHours: {} as Record<number, TimeRange>,
    };
  }

  const selectedDays = [...new Set(slots.map((slot) => slot.dayOfWeek))].sort((a, b) => a - b);
  const perDayHours: Record<number, TimeRange> = {};

  for (const slot of slots) {
    perDayHours[slot.dayOfWeek] = {
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
  }

  const firstSlot = slots[0];
  const sameHoursForAllDays = slots.every(
    (slot) => slot.startTime === firstSlot.startTime && slot.endTime === firstSlot.endTime
  );

  return {
    selectedDays,
    sameHoursForAllDays,
    sharedHours: sameHoursForAllDays
      ? { startTime: firstSlot.startTime, endTime: firstSlot.endTime }
      : { startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME },
    perDayHours,
  };
}

export function buildDaySchedules(
  selectedDays: number[],
  sameHoursForAllDays: boolean,
  sharedHours: TimeRange,
  perDayHours: Record<number, TimeRange>
): DaySchedule[] {
  return selectedDays.map((dayOfWeek) => {
    const hours = sameHoursForAllDays ? sharedHours : perDayHours[dayOfWeek] ?? sharedHours;

    return {
      dayOfWeek,
      startTime: hours.startTime,
      endTime: hours.endTime,
    };
  });
}

export async function fetchMyAvailabilitySlots(token: string) {
  const response = await api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', {
    token,
  });

  return response.slots;
}

export async function createAvailabilitySlot(
  token: string,
  schedule: DaySchedule
) {
  const response = await api<{ slot: AvailabilitySlot }>('/artisans/availability-slots', {
    method: 'POST',
    token,
    body: JSON.stringify(schedule),
  });

  return response.slot;
}

export async function deleteAvailabilitySlot(token: string, slotId: string) {
  await api(`/artisans/availability-slots/${slotId}`, {
    method: 'DELETE',
    token,
  });
}

export async function syncAvailabilitySlots(token: string, schedules: DaySchedule[]) {
  const existing = await fetchMyAvailabilitySlots(token).catch(() => [] as AvailabilitySlot[]);

  await Promise.all(existing.map((slot) => deleteAvailabilitySlot(token, slot.id)));

  for (const schedule of schedules) {
    await createAvailabilitySlot(token, schedule);
  }
}
