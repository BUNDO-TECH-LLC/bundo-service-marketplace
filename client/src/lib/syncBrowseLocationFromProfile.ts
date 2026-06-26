import type { ApiUser } from '../types';
import { formatBrowseLocationLabel, stateLocationId } from './locationDisplay';
import { readLocationPreference, type StoredLocationPreference } from './locationPreference';

export function hasActiveBrowseLocation(preference: StoredLocationPreference | null) {
  if (!preference) {
    return false;
  }

  if (
    preference.source === 'auto' ||
    preference.source === 'manual' ||
    preference.source === 'profile'
  ) {
    return Boolean(preference.state.trim() || preference.locationId?.trim());
  }

  return false;
}

export function buildProfileBrowseLocation(
  me: Pick<ApiUser, 'state' | 'area' | 'locationId' | 'locationLat' | 'locationLng'>
) {
  const state = me.state?.trim() ?? '';
  const area = me.area?.trim() ?? '';

  if (!state) {
    return null;
  }

  const locationId = me.locationId?.trim() || stateLocationId(state);

  return {
    state,
    area,
    locationId,
    locationLabel: formatBrowseLocationLabel(state, area),
    lat: me.locationLat ?? null,
    lng: me.locationLng ?? null,
  };
}

export function shouldSeedBrowseFromProfile(
  me: Pick<ApiUser, 'state' | 'area' | 'locationId'> | null | undefined
) {
  if (!me?.state?.trim()) {
    return false;
  }

  return !hasActiveBrowseLocation(readLocationPreference());
}
