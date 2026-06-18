import { dayLabels } from '../../../lib/formatting';
import { ArtisanOnboardingMediaStep } from '../../../views/ArtisanOnboardingMediaStep';
import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingStepGoLive({ landing }: { landing: ArtisanLandingModel }) {
  const {
    selectedDays,
    setSelectedDays,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    portfolioImages,
    busy,
    uploadingPortfolio,
    runAction,
    uploadPortfolioFile,
    uploadPortfolioFiles,
    removePortfolioImage,
  } = landing;

  return (
    <section className="artisan-setup-card wide availability-step">
      <h2>Go live</h2>
      <p>Add photos if you have them, then choose when customers can book you.</p>

      <ArtisanOnboardingMediaStep
        portfolioImages={portfolioImages}
        busy={busy}
        uploadingPortfolio={uploadingPortfolio}
        runAction={runAction}
        uploadPortfolioFile={uploadPortfolioFile}
        uploadPortfolioFiles={uploadPortfolioFiles}
        removePortfolioImage={removePortfolioImage}
      />

      <h3>When are you available?</h3>
      <p className="muted">You can update this anytime from your dashboard.</p>

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
    </section>
  );
}
