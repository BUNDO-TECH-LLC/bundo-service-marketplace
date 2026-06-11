import { nigeriaStates } from '../lib/geo';

export function LocationBanner({
  selectedState,
  locationSource,
  isDetectingLocation,
  onChangeLocation,
  onUseMyLocation,
}: {
  selectedState: string;
  locationSource: 'auto' | 'manual' | 'none';
  isDetectingLocation: boolean;
  onChangeLocation: (state: string) => void;
  onUseMyLocation: () => void;
}) {
  if (isDetectingLocation) {
    return (
      <div className="location-banner location-banner--detecting" role="status">
        <span>Finding your location…</span>
      </div>
    );
  }

  return (
    <div className="location-banner" role="status">
      <span>
        {selectedState
          ? locationSource === 'auto'
            ? `Showing services near ${selectedState} (from your location).`
            : `Showing services in ${selectedState}.`
          : 'Choose your state to see nearby services.'}
      </span>
      <div className="location-banner-actions">
        <label className="location-banner-select">
          <span className="sr-only">Change location</span>
          <select
            value={selectedState}
            onChange={(event) => onChangeLocation(event.target.value)}
            aria-label="Change location"
          >
            <option value="">All Nigeria</option>
            {nigeriaStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="location-banner-link" onClick={onUseMyLocation}>
          Use my location
        </button>
      </div>
    </div>
  );
}
