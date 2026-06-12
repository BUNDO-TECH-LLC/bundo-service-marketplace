import { useCallback, useState } from 'react';
import { readBrowserLocation, type UseMyLocationResult } from '../lib/geolocation';
import { inferNigeriaState } from '../lib/inferNigeriaState';
import {
  clearLocationPreference,
  readLocationPreference,
  saveLocationPreference,
  type LocationSource,
} from '../lib/locationPreference';
import { coordinatesForState } from '../lib/nigeriaStateCoordinates';

export type UserLocationState = {
  selectedState: string;
  searchLat: number | null;
  searchLng: number | null;
  locationSource: LocationSource;
  isDetectingLocation: boolean;
  setSelectedState: (state: string) => void;
  setSearchCoordinates: (lat: number | null, lng: number | null) => void;
  useMyLocation: () => Promise<UseMyLocationResult>;
  clearLocation: () => void;
};

type UseUserLocationOptions = {
  onLocationApplied?: (state: string, source: LocationSource, lat: number | null, lng: number | null) => void;
};

function applyManualState(
  state: string,
  setSelectedState: (value: string) => void,
  setSearchCoordinates: (lat: number | null, lng: number | null) => void,
  setLocationSource: (value: LocationSource) => void
) {
  setSelectedState(state);
  if (state) {
    const coords = coordinatesForState(state);
    setSearchCoordinates(coords.lat, coords.lng);
    setLocationSource('manual');
    saveLocationPreference({
      source: 'manual',
      state,
      lat: coords.lat,
      lng: coords.lng,
      promptStatus: readLocationPreference()?.promptStatus ?? null,
    });
    return;
  }

  setSearchCoordinates(null, null);
  setLocationSource('none');
  clearLocationPreference();
}

export function useUserLocation(options?: UseUserLocationOptions): UserLocationState {
  const stored = readLocationPreference();
  const [selectedState, setSelectedStateInternal] = useState(stored?.state ?? '');
  const [searchLat, setSearchLat] = useState<number | null>(stored?.lat ?? null);
  const [searchLng, setSearchLng] = useState<number | null>(stored?.lng ?? null);
  const [locationSource, setLocationSource] = useState<LocationSource>(stored?.source ?? 'none');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const onLocationApplied = options?.onLocationApplied;

  const setSearchCoordinates = useCallback((lat: number | null, lng: number | null) => {
    setSearchLat(lat);
    setSearchLng(lng);
  }, []);

  const applyAutoLocation = useCallback(
    (lat: number, lng: number) => {
      const state = inferNigeriaState(lat, lng);
      setSelectedStateInternal(state);
      setSearchLat(lat);
      setSearchLng(lng);
      setLocationSource('auto');
      saveLocationPreference({
        source: 'auto',
        state,
        lat,
        lng,
        promptStatus: 'granted',
      });
      onLocationApplied?.(state, 'auto', lat, lng);
      return state;
    },
    [onLocationApplied]
  );

  const useMyLocation = useCallback(async (): Promise<UseMyLocationResult> => {
    setIsDetectingLocation(true);
    try {
      const result = await readBrowserLocation();
      if (!result.ok) {
        if (result.reason === 'denied') {
          saveLocationPreference({
            source: locationSource,
            state: selectedState,
            lat: searchLat,
            lng: searchLng,
            promptStatus: 'denied',
          });
        }
        return {
          ok: false,
          reason: result.reason,
          permissionGranted: result.permissionGranted,
        };
      }

      const state = applyAutoLocation(result.lat, result.lng);
      return { ok: true, state, lat: result.lat, lng: result.lng };
    } finally {
      setIsDetectingLocation(false);
    }
  }, [applyAutoLocation, locationSource, searchLat, searchLng, selectedState]);

  const setSelectedState = useCallback(
    (state: string) => {
      applyManualState(state, setSelectedStateInternal, setSearchCoordinates, setLocationSource);
      if (state) {
        const coords = coordinatesForState(state);
        onLocationApplied?.(state, 'manual', coords.lat, coords.lng);
      } else {
        onLocationApplied?.('', 'none', null, null);
      }
    },
    [onLocationApplied, setSearchCoordinates]
  );

  const clearLocation = useCallback(() => {
    setSelectedStateInternal('');
    setSearchCoordinates(null, null);
    setLocationSource('none');
    clearLocationPreference();
    onLocationApplied?.('', 'none', null, null);
  }, [onLocationApplied, setSearchCoordinates]);

  return {
    selectedState,
    searchLat,
    searchLng,
    locationSource,
    isDetectingLocation,
    setSelectedState,
    setSearchCoordinates,
    useMyLocation,
    clearLocation,
  };
}
