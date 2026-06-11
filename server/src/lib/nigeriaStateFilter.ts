import type { Prisma } from '@prisma/client';
import { distanceKm } from './geoDistance';

/** Approximate state hubs — mirrors client/src/lib/nigeriaStateCoordinates.ts */
export const nigeriaStateCoordinates: Record<string, { lat: number; lng: number }> = {
  Abia: { lat: 5.4527, lng: 7.5248 },
  Adamawa: { lat: 9.3265, lng: 12.3984 },
  'Akwa Ibom': { lat: 5.0377, lng: 7.9128 },
  Anambra: { lat: 6.2209, lng: 7.072 },
  Bauchi: { lat: 10.3158, lng: 9.8442 },
  Bayelsa: { lat: 4.7719, lng: 6.0699 },
  Benue: { lat: 7.3369, lng: 8.7404 },
  Borno: { lat: 11.8333, lng: 13.15 },
  'Cross River': { lat: 5.8702, lng: 8.5988 },
  Delta: { lat: 5.532, lng: 5.898 },
  Ebonyi: { lat: 6.2649, lng: 8.0137 },
  Edo: { lat: 6.335, lng: 5.6037 },
  Ekiti: { lat: 7.6233, lng: 5.2209 },
  Enugu: { lat: 6.4584, lng: 7.5464 },
  Gombe: { lat: 10.2891, lng: 11.1673 },
  Imo: { lat: 5.492, lng: 7.026 },
  Jigawa: { lat: 12.228, lng: 9.5616 },
  Kaduna: { lat: 10.5105, lng: 7.4165 },
  Kano: { lat: 12.0022, lng: 8.592 },
  Katsina: { lat: 12.9908, lng: 7.6018 },
  Kebbi: { lat: 12.4539, lng: 4.1975 },
  Kogi: { lat: 7.7337, lng: 6.6906 },
  Kwara: { lat: 8.9669, lng: 4.3874 },
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Nasarawa: { lat: 8.4927, lng: 8.5153 },
  Niger: { lat: 9.6008, lng: 6.5497 },
  Ogun: { lat: 7.1608, lng: 3.3481 },
  Ondo: { lat: 7.2507, lng: 5.2103 },
  Osun: { lat: 7.5629, lng: 4.52 },
  Oyo: { lat: 7.3775, lng: 3.947 },
  Plateau: { lat: 9.8965, lng: 8.8583 },
  Rivers: { lat: 4.8156, lng: 7.0498 },
  Sokoto: { lat: 13.0059, lng: 5.2476 },
  Taraba: { lat: 8.8833, lng: 11.3667 },
  Yobe: { lat: 11.748, lng: 11.966 },
  Zamfara: { lat: 12.1704, lng: 6.6599 },
  FCT: { lat: 9.0579, lng: 7.4951 },
};

/** Well-known cities/areas used by artisans when `city` is not the state name itself. */
export const majorCitiesByState: Record<string, string[]> = {
  Lagos: ['Lagos', 'Ikeja', 'Lekki', 'Surulere', 'Yaba', 'Ajah', 'Victoria Island', 'VI', 'Ikoyi', 'Badagry', 'Epe'],
  FCT: ['FCT', 'Abuja', 'Gwagwalada'],
  Rivers: ['Rivers', 'Port Harcourt', 'PH'],
  Oyo: ['Oyo', 'Ibadan'],
  Kaduna: ['Kaduna', 'Zaria'],
  Kano: ['Kano'],
  Delta: ['Delta', 'Warri', 'Asaba'],
  Edo: ['Edo', 'Benin', 'Benin City'],
  Ogun: ['Ogun', 'Abeokuta', 'Sango', 'Ifo', 'Mowe'],
  Enugu: ['Enugu', 'Nsukka'],
  Anambra: ['Anambra', 'Awka', 'Onitsha', 'Nnewi'],
  Imo: ['Imo', 'Owerri'],
  'Akwa Ibom': ['Akwa Ibom', 'Uyo'],
  'Cross River': ['Cross River', 'Calabar'],
  Plateau: ['Plateau', 'Jos'],
  Kwara: ['Kwara', 'Ilorin'],
  Osun: ['Osun', 'Osogbo'],
  Ondo: ['Ondo', 'Akure'],
  Ekiti: ['Ekiti', 'Ado Ekiti'],
  Nasarawa: ['Nasarawa', 'Lafia'],
  Benue: ['Benue', 'Makurdi'],
  Kogi: ['Kogi', 'Lokoja'],
  Niger: ['Niger', 'Minna'],
  Bauchi: ['Bauchi'],
  Borno: ['Borno', 'Maiduguri'],
  Adamawa: ['Adamawa', 'Yola'],
  Gombe: ['Gombe'],
  Taraba: ['Taraba', 'Jalingo'],
  Yobe: ['Yobe', 'Damaturu'],
  Sokoto: ['Sokoto'],
  Kebbi: ['Kebbi', 'Birnin Kebbi'],
  Zamfara: ['Zamfara', 'Gusau'],
  Katsina: ['Katsina'],
  Jigawa: ['Jigawa', 'Dutse'],
  Abia: ['Abia', 'Aba', 'Umuahia'],
  Ebonyi: ['Ebonyi', 'Abakaliki'],
  Bayelsa: ['Bayelsa', 'Yenagoa'],
};

const STATE_MATCH_RADIUS_KM = 180;

export type ParsedLocationFilters = {
  state?: string;
  city?: string;
};

function normalizeLocationToken(value: string) {
  return value.trim().toLowerCase();
}

function appendAndClause(
  where: Prisma.ArtisanProfileWhereInput,
  clause: Prisma.ArtisanProfileWhereInput
) {
  if (!clause || Object.keys(clause).length === 0) {
    return;
  }

  const existing = where.AND
    ? Array.isArray(where.AND)
      ? where.AND
      : [where.AND]
    : [];
  where.AND = [...existing, clause];
}

export function isKnownNigeriaState(value: string) {
  return Object.prototype.hasOwnProperty.call(nigeriaStateCoordinates, value);
}

export function normalizeArtisanCity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Lagos';
  }

  if (isKnownNigeriaState(trimmed)) {
    return trimmed;
  }

  for (const [state, cities] of Object.entries(majorCitiesByState)) {
    if (cities.some((city) => normalizeLocationToken(city) === normalizeLocationToken(trimmed))) {
      return state;
    }
  }

  return trimmed;
}

/** Persist a canonical state in `city`, using GPS when the text is an unknown neighbourhood. */
export function normalizeArtisanLocation(city: string, lat?: number, lng?: number) {
  const fromName = normalizeArtisanCity(city);
  if (isKnownNigeriaState(fromName)) {
    return fromName;
  }

  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return inferNigeriaStateFromCoordinates(lat, lng);
  }

  return fromName;
}

export function resolveStateFromLocationInput(state?: string, city?: string): string | undefined {
  const stateValue = state?.trim();
  if (stateValue && isKnownNigeriaState(stateValue)) {
    return stateValue;
  }

  const cityValue = city?.trim();
  if (cityValue) {
    const fromCity = normalizeArtisanCity(cityValue);
    if (isKnownNigeriaState(fromCity)) {
      return fromCity;
    }
  }

  if (stateValue) {
    const fromStateField = normalizeArtisanCity(stateValue);
    if (isKnownNigeriaState(fromStateField)) {
      return fromStateField;
    }
  }

  return undefined;
}

export function parseLocationFilters(state?: unknown, city?: unknown): ParsedLocationFilters {
  const stateValue = typeof state === 'string' ? state.trim() : '';
  const cityValue = typeof city === 'string' ? city.trim() : '';
  const resolvedState = resolveStateFromLocationInput(stateValue || undefined, cityValue || undefined);

  if (resolvedState) {
    return { state: resolvedState };
  }

  if (cityValue) {
    return { city: cityValue };
  }

  return {};
}

function labelsForState(state: string) {
  const labels = majorCitiesByState[state] ?? [state];
  return [...new Set([state, ...labels])];
}

function cityMatchesForState(state: string) {
  return labelsForState(state).map((label) => ({
    city: { equals: label, mode: 'insensitive' as const },
  }));
}

function areaMatchesForState(state: string) {
  return labelsForState(state).flatMap((label) => [
    { area: { equals: label, mode: 'insensitive' as const } },
    { area: { contains: label, mode: 'insensitive' as const } },
  ]);
}

function coordinatesWithinState(state: string): Prisma.ArtisanProfileWhereInput | null {
  const hub = nigeriaStateCoordinates[state];
  if (!hub) {
    return null;
  }

  const cosLat = Math.max(Math.cos((hub.lat * Math.PI) / 180), 0.01);
  const deltaLat = STATE_MATCH_RADIUS_KM / 111;
  const deltaLng = STATE_MATCH_RADIUS_KM / (111 * cosLat);

  return {
    lat: { gte: hub.lat - deltaLat, lte: hub.lat + deltaLat },
    lng: { gte: hub.lng - deltaLng, lte: hub.lng + deltaLng },
  };
}

/** Build a Prisma filter that matches artisans serving a given Nigerian state. */
export function buildNigeriaStateWhere(state: string): Prisma.ArtisanProfileWhereInput {
  const trimmed = state.trim();
  if (!trimmed || !isKnownNigeriaState(trimmed)) {
    return {};
  }

  const coordinateMatch = coordinatesWithinState(trimmed);

  return {
    OR: [
      ...cityMatchesForState(trimmed),
      ...areaMatchesForState(trimmed),
      ...(coordinateMatch ? [coordinateMatch] : []),
    ],
  };
}

/** Match legacy city/neighbourhood text when no state is provided. */
export function buildCityOrStateWhere(location: string): Prisma.ArtisanProfileWhereInput {
  const trimmed = location.trim();
  if (!trimmed) {
    return {};
  }

  const resolvedState = normalizeArtisanCity(trimmed);
  if (isKnownNigeriaState(resolvedState)) {
    return buildNigeriaStateWhere(resolvedState);
  }

  return {
    OR: [
      { city: { equals: trimmed, mode: 'insensitive' } },
      { city: { contains: trimmed, mode: 'insensitive' } },
      { area: { equals: trimmed, mode: 'insensitive' } },
      { area: { contains: trimmed, mode: 'insensitive' } },
    ],
  };
}

export function applyArtisanLocationFilter(
  where: Prisma.ArtisanProfileWhereInput,
  filters: { state?: string; city?: string }
) {
  if (filters.state) {
    appendAndClause(where, buildNigeriaStateWhere(filters.state));
    return;
  }

  if (filters.city) {
    appendAndClause(where, buildCityOrStateWhere(filters.city));
  }
}

export function inferNigeriaStateFromCoordinates(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'Lagos';
  }

  let nearestState = 'Lagos';
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [state, coords] of Object.entries(nigeriaStateCoordinates)) {
    const distance = distanceKm(lat, lng, coords.lat, coords.lng);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestState = state;
    }
  }

  return nearestState;
}
