import { ValidationError } from '../utils/errors';

export type AvailabilitySlotInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

function toMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function bookingFitsAvailability(
  scheduledAt: Date,
  slots: AvailabilitySlotInput[]
) {
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

export function validateBookingSchedule(
  scheduledAt: Date,
  slots: AvailabilitySlotInput[]
) {
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new ValidationError('scheduledAt must be a valid date');
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new ValidationError('Choose a date and time in the future.');
  }

  if (!bookingFitsAvailability(scheduledAt, slots)) {
    throw new ValidationError(
      'This time is outside the artisan’s available hours. Pick another slot.'
    );
  }
}

export function validateAvailabilitySlotTimes(startTime: string, endTime: string) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new ValidationError('Availability times must use HH:MM format.');
  }

  if (end <= start) {
    throw new ValidationError('End time must be after start time.');
  }
}
