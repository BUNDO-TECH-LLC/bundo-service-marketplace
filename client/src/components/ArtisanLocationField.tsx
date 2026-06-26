import { useState } from 'react';
import { LocationPicker } from './LocationPicker';
import { LocationTrigger } from './LocationTrigger';
import type { LocationListItem } from '../types/location';

export function ArtisanLocationField({
  locationLabel,
  onSelect,
  onUseMyLocation,
  disabled = false,
  isDetectingLocation = false,
}: {
  locationLabel: string;
  onSelect: (item: LocationListItem) => void;
  onUseMyLocation?: () => void;
  disabled?: boolean;
  isDetectingLocation?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <LocationTrigger
        locationLabel={locationLabel}
        isDetectingLocation={isDetectingLocation}
        disabled={disabled}
        onOpen={() => setOpen(true)}
        onUseMyLocation={onUseMyLocation}
      />
      <LocationPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onSelect(item);
          setOpen(false);
        }}
      />
    </>
  );
}
