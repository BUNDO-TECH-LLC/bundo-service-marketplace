import { formatBrowseLocationLabel, stateLocationId } from './locationDisplay';
import { coordinatesForState } from './nigeriaStateCoordinates';
import type { LocationListItem } from '../types/location';
import type { ApiUser } from '../types';

export type ArtisanLocationSelection = {
  state: string;
  area: string;
  locationId: string;
  locationLabel: string;
  lat: number;
  lng: number;
};

export function artisanLocationFromCatalogItem(item: LocationListItem): ArtisanLocationSelection {
  const state = item.state?.trim() ?? '';
  const area =
    item.kind === 'area'
      ? item.area?.trim() || item.label.split(',')[0]?.trim() || ''
      : '';
  const lat = Number.isFinite(item.lat) ? item.lat : state ? coordinatesForState(state).lat : 6.5244;
  const lng = Number.isFinite(item.lng) ? item.lng : state ? coordinatesForState(state).lng : 3.3792;

  return {
    state,
    area,
    locationId: item.id,
    locationLabel: item.label,
    lat,
    lng,
  };
}

export function profileLocationFromUser(
  user: Pick<ApiUser, 'state' | 'area' | 'locationId' | 'locationLat' | 'locationLng'>
): ArtisanLocationSelection {
  const state = user.state?.trim() ?? '';
  const area = user.area?.trim() ?? '';
  const locationId = user.locationId?.trim() || (state ? stateLocationId(state) : '');
  const fallback = state ? coordinatesForState(state) : { lat: 6.5244, lng: 3.3792 };

  return {
    state,
    area,
    locationId,
    locationLabel: formatBrowseLocationLabel(state, area),
    lat: user.locationLat ?? fallback.lat,
    lng: user.locationLng ?? fallback.lng,
  };
}

export function artisanLocationFromProfile(city?: string | null, area?: string | null): ArtisanLocationSelection {
  const state = city?.trim() ?? '';
  const trimmedArea = area?.trim() ?? '';

  return {
    state,
    area: trimmedArea,
    locationId: state ? stateLocationId(state) : '',
    locationLabel: formatBrowseLocationLabel(state, trimmedArea),
    lat: state ? coordinatesForState(state).lat : 6.5244,
    lng: state ? coordinatesForState(state).lng : 3.3792,
  };
}

export function artisanLocationFromGps(state: string, lat: number, lng: number): ArtisanLocationSelection {
  return {
    state,
    area: '',
    locationId: stateLocationId(state),
    locationLabel: formatBrowseLocationLabel(state),
    lat,
    lng,
  };
}
