import { browseLocationPlaceholder } from '../lib/locationDisplay';

export function LocationTrigger({
  locationLabel,
  isDetectingLocation = false,
  disabled = false,
  onOpen,
  onUseMyLocation,
  className = '',
  id,
}: {
  locationLabel: string;
  isDetectingLocation?: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onUseMyLocation?: () => void;
  className?: string;
  id?: string;
}) {
  const displayLabel = locationLabel.trim() || browseLocationPlaceholder(isDetectingLocation);

  return (
    <div className={`location-trigger ${className}`.trim()}>
      {onUseMyLocation ? (
        <button
          type="button"
          className="location-trigger-gps"
          disabled={disabled || isDetectingLocation}
          aria-label="Use my current location"
          title="Use my current location"
          onClick={onUseMyLocation}
        >
          <span aria-hidden="true">⌖</span>
        </button>
      ) : null}
      <button
        type="button"
        id={id}
        className="location-trigger-select"
        disabled={disabled || isDetectingLocation}
        aria-label="Choose location"
        onClick={onOpen}
      >
        <span className="location-trigger-label">{displayLabel}</span>
        <span className="location-trigger-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
    </div>
  );
}
