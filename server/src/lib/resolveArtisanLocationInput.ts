import {
  findAreaNode,
  getLocationById,
  resolveLocationFiltersFromId,
  stateIdForStateName,
} from './nigeriaLocationCatalog';
import { nigeriaStateCoordinates } from './nigeriaStateFilter';

export type ResolvedArtisanLocationInput = {
  city: string;
  area: string | null;
  lat: number;
  lng: number;
  locationId: string;
};

export function resolveArtisanLocationInput(input: {
  locationId?: string;
  state?: string;
  city?: string;
  area?: string | null;
  lat?: number;
  lng?: number;
}): ResolvedArtisanLocationInput | null {
  const locationId = input.locationId?.trim();
  if (locationId) {
    const node = getLocationById(locationId);
    const resolved = resolveLocationFiltersFromId(locationId);
    if (node && resolved.state) {
      return {
        city: resolved.state,
        area: resolved.area ?? null,
        lat: resolved.lat ?? node.lat,
        lng: resolved.lng ?? node.lng,
        locationId,
      };
    }
  }

  const stateName = input.state?.trim() || input.city?.trim();
  if (!stateName) {
    return null;
  }

  const area = input.area?.trim() ? input.area.trim() : null;

  if (area) {
    const areaNode = findAreaNode(stateName, area);
    if (areaNode) {
      return {
        city: stateName,
        area: areaNode.area ?? areaNode.label,
        lat: areaNode.lat,
        lng: areaNode.lng,
        locationId: areaNode.id,
      };
    }
  }

  const stateId = stateIdForStateName(stateName);
  const hub = nigeriaStateCoordinates[stateName];
  if (stateId && hub) {
    const lat = input.lat ?? hub.lat;
    const lng = input.lng ?? hub.lng;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        city: stateName,
        area,
        lat,
        lng,
        locationId: stateId,
      };
    }
  }

  if (
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    return {
      city: stateName,
      area,
      lat: input.lat,
      lng: input.lng,
      locationId: stateId ?? '',
    };
  }

  return null;
}

/** Same resolver; accepts `state` instead of artisan `city`. */
export function resolveUserLocationInput(input: {
  locationId?: string;
  state?: string;
  area?: string | null;
}) {
  const resolved = resolveArtisanLocationInput(input);
  if (!resolved) {
    return null;
  }

  return {
    state: resolved.city,
    area: resolved.area,
    lat: resolved.lat,
    lng: resolved.lng,
    locationId: resolved.locationId,
  };
}
