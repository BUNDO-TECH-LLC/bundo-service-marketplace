import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  buildTimeOptionsForDate,
  formatAvailabilityHint,
  todayDateInputValue,
  validateBookingDateTime,
} from '../lib/bookingSchedule';
import { money } from '../lib/formatting';
import { formatStarDisplay } from '../lib/ratingDisplay';
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

  const artisan = offering.artisan;
  const artisanName = artisan?.displayName || 'Approved artisan';
  const avgRating = artisan?.avgRating || 0;
  const ratingCount = artisan?.ratingCount || 0;

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
    <div className="prompt-dialog-backdrop book-offering-backdrop" role="presentation" onClick={onClose}>
      <form
        className="book-offering-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-offering-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="book-offering-dialog-card">
          <div className="recommended-card-head">
            <span className="recommended-avatar" aria-hidden="true">
              {artisanName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2 id="book-offering-title">{artisanName}</h2>
              <p>{artisan?.area || artisan?.city || 'Nearby'}</p>
            </div>
            <small>{artisan?.city || 'Bundo'}</small>
          </div>

          <div className="recommended-tags">
            <span>{offering.category?.name || 'Service'}</span>
            <span>{offering.title}</span>
          </div>

          <div className="recommended-meta">
            <span className="rating">{formatStarDisplay(avgRating)}</span>
            <span>
              {avgRating.toFixed(1)}({ratingCount})
            </span>
            <strong>
              From {money(offering.priceFrom)}
              {offering.priceTo ? ` – ${money(offering.priceTo)}` : ''}
            </strong>
          </div>
        </div>

        <p className="book-offering-dialog-lead">
          Choose when you need {artisanName}. Final price is agreed before payment.
        </p>
        <p className="book-offering-dialog-availability">{formatAvailabilityHint(slots)}</p>

        <div className="book-offering-dialog-fields">
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
            Note for artisan <span className="book-offering-dialog-optional">(optional)</span>
            <textarea
              value={note}
              maxLength={500}
              rows={3}
              placeholder="Share access details, preferred contact time, or job specifics."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        {error && <p className="book-offering-dialog-error">{error}</p>}

        <div className="book-offering-dialog-actions">
          <button
            type="submit"
            className="primary-button book-offering-dialog-submit"
            disabled={busy || !date || !time}
          >
            {busy ? 'Booking…' : 'Request booking'}
          </button>
          <button type="button" className="text-button book-offering-dialog-cancel" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
