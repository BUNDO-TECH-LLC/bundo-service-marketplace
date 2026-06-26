import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, PUBLIC_API_TIMEOUT_MS } from '../lib/api';
import { readBrowserLocation, type UseMyLocationResult } from '../lib/geolocation';
import { inferNigeriaState } from '../lib/inferNigeriaState';
import { formatBrowseLocationLabel, stateLocationId } from '../lib/locationDisplay';
import {
  clearLocationPreference,
  readLocationPreference,
  saveLocationPreference,
  type LocationSource,
} from '../lib/locationPreference';
import { coordinatesForState } from '../lib/nigeriaStateCoordinates';
import type { LocationListItem } from '../types/location';

export type UserLocationState = {
  selectedState: string;
  selectedArea: string;
  locationId: string;
  locationLabel: string;
  searchLat: number | null;
  searchLng: number | null;
  locationSource: LocationSource;
  isDetectingLocation: boolean;
  setSelectedState: (state: string) => void;
  applyLocationSelection: (item: LocationListItem) => void;
  applyProfileLocation: (
    state: string,
    area?: string | null,
    options?: {
      locationId?: string | null;
      locationLabel?: string | null;
      lat?: number | null;
      lng?: number | null;
    }
  ) => void;
  setSearchCoordinates: (lat: number | null, lng: number | null) => void;
  useMyLocation: () => Promise<UseMyLocationResult>;
  clearLocation: () => void;
};

type UseUserLocationOptions = {
  onLocationApplied?: (
    state: string,
    area: string,
    source: LocationSource,
    lat: number | null,
    lng: number | null,
    locationId?: string
  ) => void;
};

function coordsForItem(item: LocationListItem) {
  if (Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
    return { lat: item.lat, lng: item.lng };
  }

  const state = item.state?.trim() ?? '';
  return state ? coordinatesForState(state) : { lat: null, lng: null };
}

function persistManualSelection(input: {
  state: string;
  area?: string;
  locationId?: string;
  locationLabel?: string;
  lat: number | null;
  lng: number | null;
  source?: LocationSource;
}) {
  saveLocationPreference({
    source: input.source ?? 'manual',
    state: input.state,
    area: input.area ?? '',
    locationId: input.locationId ?? (input.state ? stateLocationId(input.state) : ''),
    locationLabel:
      input.locationLabel ?? formatBrowseLocationLabel(input.state, input.area),
    lat: input.lat,
    lng: input.lng,
    promptStatus: readLocationPreference()?.promptStatus ?? null,
  });
}

export function useUserLocation(options?: UseUserLocationOptions): UserLocationState {
  const stored = readLocationPreference();
  const [selectedState, setSelectedStateInternal] = useState(stored?.state ?? '');
  const [selectedArea, setSelectedArea] = useState(stored?.area ?? '');
  const [locationId, setLocationId] = useState(stored?.locationId ?? '');
  const [locationLabel, setLocationLabel] = useState(
    stored?.locationLabel ?? formatBrowseLocationLabel(stored?.state ?? '', stored?.area)
  );
  const [searchLat, setSearchLat] = useState<number | null>(stored?.lat ?? null);
  const [searchLng, setSearchLng] = useState<number | null>(stored?.lng ?? null);
  const [locationSource, setLocationSource] = useState<LocationSource>(stored?.source ?? 'none');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const onLocationApplied = options?.onLocationApplied;

  const setSearchCoordinates = useCallback((lat: number | null, lng: number | null) => {
    setSearchLat(lat);
    setSearchLng(lng);
  }, []);

  const notifyApplied = useCallback(
    (
      state: string,
      area: string,
      source: LocationSource,
      lat: number | null,
      lng: number | null,
      nextLocationId?: string
    ) => {
      onLocationApplied?.(state, area, source, lat, lng, nextLocationId);
    },
    [onLocationApplied]
  );

  const applyManualState = useCallback(
    (state: string) => {
      setSelectedStateInternal(state);
      setSelectedArea('');
      const nextLocationId = state ? stateLocationId(state) : '';
      setLocationId(nextLocationId);
      setLocationLabel(formatBrowseLocationLabel(state));

      if (state) {
        const coords = coordinatesForState(state);
        setSearchCoordinates(coords.lat, coords.lng);
        setLocationSource('manual');
        persistManualSelection({
          state,
          locationId: nextLocationId,
          lat: coords.lat,
          lng: coords.lng,
        });
        notifyApplied(state, '', 'manual', coords.lat, coords.lng, nextLocationId);
        return;
      }

      setSearchCoordinates(null, null);
      setLocationSource('none');
      clearLocationPreference();
      notifyApplied('', '', 'none', null, null);
    },
    [notifyApplied, setSearchCoordinates]
  );

  const applyLocationSelection = useCallback(
    (item: LocationListItem) => {
      const state = item.state?.trim() ?? '';
      const area = item.kind === 'area' ? item.area?.trim() ?? item.label.split(',')[0]?.trim() ?? '' : '';
      const coords = coordsForItem(item);

      setSelectedStateInternal(state);
      setSelectedArea(area);
      setLocationId(item.id);
      setLocationLabel(item.label);
      setSearchCoordinates(coords.lat, coords.lng);
      setLocationSource('manual');
      persistManualSelection({
        state,
        area,
        locationId: item.id,
        locationLabel: item.label,
        lat: coords.lat,
        lng: coords.lng,
      });
      notifyApplied(state, area, 'manual', coords.lat, coords.lng, item.id);
    },
    [notifyApplied, setSearchCoordinates]
  );

  const applyProfileLocation = useCallback(
    (
      state: string,
      area?: string | null,
      options?: {
        locationId?: string | null;
        locationLabel?: string | null;
        lat?: number | null;
        lng?: number | null;
      }
    ) => {
      const trimmedState = state.trim();
      if (!trimmedState) {
        return;
      }

      const trimmedArea = area?.trim() ?? '';
      const nextLocationId = options?.locationId?.trim() || stateLocationId(trimmedState);
      const label = options?.locationLabel?.trim() || formatBrowseLocationLabel(trimmedState, trimmedArea);
      const fallback = coordinatesForState(trimmedState);
      const lat = options?.lat ?? fallback.lat;
      const lng = options?.lng ?? fallback.lng;

      setSelectedStateInternal(trimmedState);
      setSelectedArea(trimmedArea);
      setLocationId(nextLocationId);
      setLocationLabel(label);
      setSearchCoordinates(lat, lng);
      setLocationSource('profile');
      saveLocationPreference({
        source: 'profile',
        state: trimmedState,
        area: trimmedArea,
        locationId: nextLocationId,
        locationLabel: label,
        lat,
        lng,
        promptStatus: readLocationPreference()?.promptStatus ?? null,
      });
      notifyApplied(trimmedState, trimmedArea, 'profile', lat, lng, nextLocationId);
    },
    [notifyApplied, setSearchCoordinates]
  );

  const applyAutoLocation = useCallback(
    (lat: number, lng: number) => {
      const state = inferNigeriaState(lat, lng);
      setSelectedStateInternal(state);
      setSelectedArea('');
      const nextLocationId = stateLocationId(state);
      setLocationId(nextLocationId);
      setLocationLabel(formatBrowseLocationLabel(state));
      setSearchLat(lat);
      setSearchLng(lng);
      setLocationSource('auto');
      saveLocationPreference({
        source: 'auto',
        state,
        area: '',
        locationId: nextLocationId,
        locationLabel: formatBrowseLocationLabel(state),
        lat,
        lng,
        promptStatus: 'granted',
      });
      notifyApplied(state, '', 'auto', lat, lng, nextLocationId);
      return state;
    },
    [notifyApplied]
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
            area: selectedArea,
            locationId,
            locationLabel,
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
  }, [
    applyAutoLocation,
    locationId,
    locationLabel,
    locationSource,
    searchLat,
    searchLng,
    selectedArea,
    selectedState,
  ]);

  const setSelectedState = useCallback(
    (state: string) => {
      applyManualState(state);
    },
    [applyManualState]
  );

  const clearLocation = useCallback(() => {
    setSelectedStateInternal('');
    setSelectedArea('');
    setLocationId('');
    setLocationLabel('Nigeria');
    setSearchCoordinates(null, null);
    setLocationSource('none');
    clearLocationPreference();
    notifyApplied('', '', 'none', null, null);
  }, [notifyApplied, setSearchCoordinates]);

  return useMemo(
    () => ({
      selectedState,
      selectedArea,
      locationId,
      locationLabel,
      searchLat,
      searchLng,
      locationSource,
      isDetectingLocation,
      setSelectedState,
      applyLocationSelection,
      applyProfileLocation,
      setSearchCoordinates,
      useMyLocation,
      clearLocation,
    }),
    [
      applyLocationSelection,
      applyProfileLocation,
      clearLocation,
      isDetectingLocation,
      locationId,
      locationLabel,
      locationSource,
      searchLat,
      searchLng,
      selectedArea,
      selectedState,
      setSearchCoordinates,
      setSelectedState,
      useMyLocation,
    ]
  );
}
