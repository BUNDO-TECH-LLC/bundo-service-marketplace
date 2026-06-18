import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { dayLabels } from '../lib/formatting';
import type { ActionRunner } from '../appTypes';
import type { AvailabilitySlot } from '../types';

export function ArtisanAvailabilityEditor({
  token,
  busy,
  runAction,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
}) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  async function loadSlots() {
    const response = await api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token });
    setSlots(response.slots);
  }

  useEffect(() => {
    void loadSlots().catch(() => setSlots([]));
  }, [token]);

  async function addSlot(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/artisans/availability-slots', {
      method: 'POST',
      token,
      body: JSON.stringify({
        dayOfWeek: Number(form.get('dayOfWeek')),
        startTime: form.get('startTime'),
        endTime: form.get('endTime'),
      }),
    });
    formElement.reset();
    await loadSlots();
  }

  async function toggleSlot(slot: AvailabilitySlot) {
    await api(`/artisans/availability-slots/${slot.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isActive: !slot.isActive }),
    });
    await loadSlots();
  }

  async function removeSlot(slotId: string) {
    await api(`/artisans/availability-slots/${slotId}`, {
      method: 'DELETE',
      token,
    });
    await loadSlots();
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const startTime = String(formData.get('startTime') || '');
    const endTime = String(formData.get('endTime') || '');
    const [startH = 0, startM = 0] = startTime.split(':').map(Number);
    const [endH = 0, endM = 0] = endTime.split(':').map(Number);

    if (endH * 60 + endM <= startH * 60 + startM) {
      void runAction(async () => {
        throw new Error('End time must be after start time.');
      }, '');
      return;
    }

    void runAction(() => addSlot(form), 'Availability updated');
  }

  return (
    <section className="artisan-settings-card">
      <h2>Availability</h2>
      <p>Set the days and hours customers can book you.</p>
      <form className="availability-form" onSubmit={handleAdd}>
        <label>
          Day
          <select name="dayOfWeek" required defaultValue="1">
            {dayLabels.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start
          <input name="startTime" type="time" defaultValue="09:00" required />
        </label>
        <label>
          End
          <input name="endTime" type="time" defaultValue="17:00" required />
        </label>
        <button type="submit" disabled={busy}>
          Add slot
        </button>
      </form>
      {slots.length === 0 && <p className="muted">No availability slots yet.</p>}
      <ul className="availability-slot-list">
        {slots.map((slot) => (
          <li key={slot.id}>
            <span>
              {dayLabels[slot.dayOfWeek]} · {slot.startTime}–{slot.endTime}
              {!slot.isActive && ' (paused)'}
            </span>
            <div className="availability-slot-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => toggleSlot(slot), slot.isActive ? 'Slot paused' : 'Slot active')}
              >
                {slot.isActive ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => removeSlot(slot.id), 'Slot removed')}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
