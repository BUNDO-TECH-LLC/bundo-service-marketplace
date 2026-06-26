import type { ApiUser } from '../types';
import { formatBrowseLocationLabel, stateLocationId } from './locationDisplay';
import { readLocationPreference, type StoredLocationPreference } from './locationPreference';

export function hasActiveBrowseLocation(preference: StoredLocationPreference | null) {
  if (!preference) {
    return false;
  }

  if (preference.source === 'auto' || preference.source === 'manual') {
    return Boolean(preference.state.trim() || preference.locationId?.trim());
  }

  return false;
}

export function buildProfileBrowseLocation(me: Pick<ApiUser, 'state' | 'area'>) {
  const state = me.state?.trim() ?? '';
  const area = me.area?.trim() ?? '';

  if (!state) {
    return null;
  }

  return {
    state,
    area,
    locationId: stateLocationId(state),
    locationLabel: formatBrowseLocationLabel(state, area),
  };
}

export function shouldSeedBrowseFromProfile(me: Pick<ApiUser, 'state' | 'area'> | null | undefined) {
  if (!me?.state?.trim()) {
    return false;
  }

  return !hasActiveBrowseLocation(readLocationPreference());
}
