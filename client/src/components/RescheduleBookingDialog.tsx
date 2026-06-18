import { FormEvent, useEffect, useState } from 'react';
import type { AvailabilitySlot, Booking } from '../types';
import { api } from '../lib/api';
import {
  buildTimeOptionsForDate,
  todayDateInputValue,
  validateBookingDateTime,
} from '../lib/bookingSchedule';

export function RescheduleBookingDialog({
  open,
  booking,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  booking: Booking | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { scheduledAt: string; note?: string }) => Promise<void>;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !booking) {
      return;
    }

    const scheduled = booking.scheduledAt ? new Date(booking.scheduledAt) : null;
    if (scheduled && !Number.isNaN(scheduled.getTime())) {
      const year = scheduled.getFullYear();
      const month = String(scheduled.getMonth() + 1).padStart(2, '0');
      const day = String(scheduled.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
      setTime(`${String(scheduled.getHours()).padStart(2, '0')}:${String(scheduled.getMinutes()).padStart(2, '0')}`);
    } else {
      setDate('');
      setTime('');
    }

    setNote(booking.note || '');
    setError('');

    const artisanId = booking.artisanId || booking.artisan?.id;
    if (!artisanId) {
      setSlots([]);
      return;
    }

    void api<{ slots: AvailabilitySlot[] }>(`/artisans/${artisanId}/availability-slots`)
      .then((response) => setSlots(response.slots))
      .catch(() => setSlots([]));
  }, [open, booking]);

  const timeOptions = buildTimeOptionsForDate(date, slots);

  if (!open || !booking) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateBookingDateTime(date, time, slots);
    if (validationError) {
      setError(validationError);
      return;
    }

    await onSubmit({
      scheduledAt: new Date(`${date}T${time}:00`).toISOString(),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  return (
    <div className="prompt-dialog-backdrop" role="presentation" onClick={onClose}>
      <form
        className="prompt-dialog book-offering-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-booking-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <h2 id="reschedule-booking-title">Reschedule booking</h2>
        <p className="prompt-dialog-message">Pick a new date and time in the future within the artisan’s hours.</p>

        <label>
          Date
          <input
            type="date"
            value={date}
            min={todayDateInputValue()}
            onChange={(event) => {
              setDate(event.target.value);
              setError('');
            }}
            required
          />
        </label>

        <label>
          Time
          <select
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              setError('');
            }}
            required
            disabled={!date || timeOptions.length === 0}
          >
            <option value="">
              {!date ? 'Select a date first' : timeOptions.length ? 'Select a time' : 'No slots this day'}
            </option>
            {timeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Note (optional)
          <textarea
            value={note}
            maxLength={500}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        {error && <p className="auth-field-error">{error}</p>}

        <div className="prompt-dialog-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !date || !time}>
            {busy ? 'Saving…' : 'Save new time'}
          </button>
        </div>
      </form>
    </div>
  );
}
