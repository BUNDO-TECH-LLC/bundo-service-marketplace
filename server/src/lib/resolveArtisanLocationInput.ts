import {
  getLocationById,
  resolveLocationFiltersFromId,
} from './nigeriaLocationCatalog';

export type ResolvedArtisanLocationInput = {
  city: string;
  area?: string | null;
  lat: number;
  lng: number;
};

export function resolveArtisanLocationInput(input: {
  locationId?: string;
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
      };
    }
  }

  const city = input.city?.trim();
  if (!city) {
    return null;
  }

  if (input.lat == null || input.lng == null || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return null;
  }

  return {
    city,
    area: input.area?.trim() ? input.area.trim() : null,
    lat: input.lat,
    lng: input.lng,
  };
}
