import { dayLabels } from '../../../lib/formatting';
import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingStepSubmit({ landing }: { landing: ArtisanLandingModel }) {
  const {
    setup,
    updateSetup,
    selectedDays,
    setSelectedDays,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    kycDocumentFile,
    setKycDocumentFile,
    submitAgreed,
    setSubmitAgreed,
    busy,
  } = landing;

  return (
    <section className="artisan-setup-card availability-step">
      <h2>When are you available?</h2>
      <p>
        Customers will only be able to book you on days and times you select. You can update this anytime from
        your dashboard.
      </p>
      <h3>Days available</h3>
      <div className="day-picker">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <button
            key={day}
            type="button"
            className={selectedDays.includes(day) ? 'active' : ''}
            onClick={() =>
              setSelectedDays((current) =>
                current.includes(day) ? current.filter((value) => value !== day) : [...current, day]
              )
            }
          >
            {dayLabels[day].slice(0, 1)}
          </button>
        ))}
      </div>
      <div className="setup-two-col">
        <label>
          From
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        </label>
        <label>
          To
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>
      </div>
      <label>
        Residential address
        <input
          value={setup.address}
          onChange={(event) => updateSetup('address', event.target.value)}
          placeholder="Address for manual verification"
        />
      </label>
      <label>
        NIN or ID number
        <input
          value={setup.documentNumber}
          onChange={(event) => updateSetup('documentNumber', event.target.value)}
          placeholder="Required for verification"
        />
      </label>
      <label>
        ID document photo
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => setKycDocumentFile(event.target.files?.[0] || null)}
        />
        <small className="muted">Upload a clear photo of your NIN slip or government ID (JPG/PNG, max 5MB).</small>
      </label>
      {kycDocumentFile && <p className="muted">Selected: {kycDocumentFile.name}</p>}
      <label className="terms-row">
        <input type="checkbox" checked={submitAgreed} onChange={(event) => setSubmitAgreed(event.target.checked)} />{' '}
        <span>
          Submitting for verification means our team will review your profile before it goes live.
        </span>
      </label>
    </section>
  );
}
