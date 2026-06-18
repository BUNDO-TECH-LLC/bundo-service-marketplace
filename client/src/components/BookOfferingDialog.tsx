import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  buildTimeOptionsForDate,
  formatAvailabilityHint,
  todayDateInputValue,
  validateBookingDateTime,
} from '../lib/bookingSchedule';
import { money } from '../lib/formatting';
import type { AvailabilitySlot, Offering } from '../types';

export function BookOfferingDialog({
  open,
  offering,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  offering: Offering | null;
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
    if (!open || !offering?.artisanId) {
      return;
    }

    setDate('');
    setTime('');
    setNote('');
    setError('');

    void api<{ slots: AvailabilitySlot[] }>(`/artisans/${offering.artisanId}/availability-slots`)
      .then((response) => setSlots(response.slots))
      .catch(() => setSlots(offering.artisan?.availabilitySlots || []));
  }, [open, offering?.artisanId, offering?.artisan?.availabilitySlots]);

  const timeOptions = buildTimeOptionsForDate(date, slots);

  useEffect(() => {
    if (time && !timeOptions.includes(time)) {
      setTime(timeOptions[0] || '');
    }
  }, [date, time, timeOptions]);

  if (!open || !offering) {
    return null;
  }

  const artisanName = offering.artisan?.displayName || 'this artisan';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateBookingDateTime(date, time, slots);
    if (validationError) {
      setError(validationError);
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    await onSubmit({
      scheduledAt,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  return (
    <div className="prompt-dialog-backdrop" role="presentation" onClick={onClose}>
      <form
        className="prompt-dialog book-offering-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-offering-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <h2 id="book-offering-title">Book {offering.title}</h2>
        <p className="prompt-dialog-message">
          Choose when you need {artisanName}. Final price is agreed before payment.
        </p>
        <p className="muted">{formatAvailabilityHint(slots)}</p>
        <p className="booking-guide-price">
          Guide price: {money(offering.priceFrom)}
          {offering.priceTo ? ` – ${money(offering.priceTo)}` : ''}
        </p>

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
          Note for artisan (optional)
          <textarea
            value={note}
            maxLength={500}
            rows={3}
            placeholder="Share access details, preferred contact time, or job specifics."
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        {error && <p className="auth-field-error">{error}</p>}

        <div className="prompt-dialog-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !date || !time}>
            {busy ? 'Booking…' : 'Request booking'}
          </button>
        </div>
      </form>
    </div>
  );
}
