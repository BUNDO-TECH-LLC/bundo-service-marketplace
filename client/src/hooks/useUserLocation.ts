import { useCallback, useEffect, useRef, useState } from 'react';
import { readBrowserLocation } from '../lib/geolocation';
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
  locationReady: boolean;
  setSelectedState: (state: string) => void;
  setSearchCoordinates: (lat: number | null, lng: number | null) => void;
  useMyLocation: () => Promise<boolean>;
  detectLocation: () => Promise<boolean>;
  clearLocation: () => void;
};

type UseUserLocationOptions = {
  onLocationApplied?: (state: string, source: LocationSource) => void;
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
  const [locationReady, setLocationReady] = useState(Boolean(stored));
  const autoDetectAttemptedRef = useRef(false);
  const onLocationAppliedRef = useRef(options?.onLocationApplied);
  onLocationAppliedRef.current = options?.onLocationApplied;

  const setSearchCoordinates = useCallback((lat: number | null, lng: number | null) => {
    setSearchLat(lat);
    setSearchLng(lng);
  }, []);

  const applyAutoLocation = useCallback((lat: number, lng: number) => {
    const state = inferNigeriaState(lat, lng);
    setSelectedStateInternal(state);
    setSearchLat(lat);
    setSearchLng(lng);
    setLocationSource('auto');
    setLocationReady(true);
    saveLocationPreference({
      source: 'auto',
      state,
      lat,
      lng,
      promptStatus: 'granted',
    });
    onLocationAppliedRef.current?.(state, 'auto');
    return state;
  }, []);

  const detectLocation = useCallback(async () => {
    setIsDetectingLocation(true);
    try {
      const result = await readBrowserLocation();
      if (!result.ok) {
        saveLocationPreference({
          source: locationSource,
          state: selectedState,
          lat: searchLat,
          lng: searchLng,
          promptStatus: result.reason === 'denied' ? 'denied' : readLocationPreference()?.promptStatus ?? null,
        });
        return false;
      }

      applyAutoLocation(result.lat, result.lng);
      return true;
    } finally {
      setIsDetectingLocation(false);
    }
  }, [applyAutoLocation, locationSource, searchLat, searchLng, selectedState]);

  const useMyLocation = useCallback(async () => {
    const success = await detectLocation();
    return success;
  }, [detectLocation]);

  const setSelectedState = useCallback(
    (state: string) => {
      applyManualState(state, setSelectedStateInternal, setSearchCoordinates, setLocationSource);
      setLocationReady(true);
      if (state) {
        onLocationAppliedRef.current?.(state, 'manual');
      }
    },
    [setSearchCoordinates]
  );

  const clearLocation = useCallback(() => {
    setSelectedStateInternal('');
    setSearchCoordinates(null, null);
    setLocationSource('none');
    setLocationReady(true);
    clearLocationPreference();
  }, [setSearchCoordinates]);

  useEffect(() => {
    if (autoDetectAttemptedRef.current) {
      return;
    }
    autoDetectAttemptedRef.current = true;

    const preference = readLocationPreference();
    if (preference?.state) {
      setLocationReady(true);
      return;
    }

    if (preference?.promptStatus === 'denied') {
      setLocationReady(true);
      return;
    }

    void detectLocation().finally(() => {
      setLocationReady(true);
    });
  }, [detectLocation]);

  return {
    selectedState,
    searchLat,
    searchLng,
    locationSource,
    isDetectingLocation,
    locationReady,
    setSelectedState,
    setSearchCoordinates,
    useMyLocation,
    detectLocation,
    clearLocation,
  };
}
