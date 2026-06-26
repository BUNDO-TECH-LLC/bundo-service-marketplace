import {
  getLocationById,
  getLocationChildren,
  resolveArtisanState,
  stateIdForStateName,
  type LocationNode,
} from './nigeriaLocationCatalog';
import {
  inferNigeriaStateFromCoordinates,
  isKnownNigeriaState,
  normalizeArtisanCity,
  nigeriaStateCoordinates,
} from './nigeriaStateFilter';

export type ArtisanLocationRecord = {
  city: string;
  area: string | null;
  lat: number;
  lng: number;
};

export type ArtisanLocationNormalizationMatch = 'area' | 'state_only' | 'unchanged';

export type ArtisanLocationNormalizationResult = {
  match: ArtisanLocationNormalizationMatch;
  reason: string;
  locationId: string | null;
  before: ArtisanLocationRecord;
  after: ArtisanLocationRecord;
  changed: boolean;
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function recordsEqual(left: ArtisanLocationRecord, right: ArtisanLocationRecord) {
  return (
    normalizeToken(left.city) === normalizeToken(right.city) &&
    normalizeToken(left.area ?? '') === normalizeToken(right.area ?? '') &&
    Math.abs(left.lat - right.lat) < 0.0001 &&
    Math.abs(left.lng - right.lng) < 0.0001
  );
}

function resolveStateName(city: string, area: string, lat: number, lng: number) {
  const fromFields = resolveArtisanState(city, area);
  if (fromFields) {
    return fromFields;
  }

  const fromCity = normalizeArtisanCity(city);
  if (isKnownNigeriaState(fromCity)) {
    return fromCity;
  }

  if (area) {
    const fromArea = normalizeArtisanCity(area);
    if (isKnownNigeriaState(fromArea)) {
      return fromArea;
    }
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return inferNigeriaStateFromCoordinates(lat, lng);
  }

  return null;
}

function pickCoordinates(
  input: ArtisanLocationRecord,
  stateName: string,
  matchedArea: LocationNode | null
) {
  if (matchedArea) {
    return { lat: matchedArea.lat, lng: matchedArea.lng };
  }

  if (Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
    const inferred = inferNigeriaStateFromCoordinates(input.lat, input.lng);
    if (inferred === stateName) {
      return { lat: input.lat, lng: input.lng };
    }
  }

  const hub = nigeriaStateCoordinates[stateName];
  if (!hub) {
    return { lat: input.lat, lng: input.lng };
  }

  return { lat: hub.lat, lng: hub.lng };
}

function nodeMatchesArtisanLocation(node: LocationNode, city: string, area: string) {
  const cityToken = normalizeToken(city);
  const areaToken = normalizeToken(area);
  const aliases = [node.label, ...node.aliases].map(normalizeToken);

  const matchesCity =
    cityToken && aliases.some((alias) => alias === cityToken || cityToken.includes(alias) || alias.includes(cityToken));
  const matchesArea =
    areaToken && aliases.some((alias) => alias === areaToken || areaToken.includes(alias) || alias.includes(areaToken));

  return Boolean(matchesCity || matchesArea);
}

function findMatchingAreaNodes(stateName: string, city: string, area: string) {
  const stateId = stateIdForStateName(stateName);
  if (!stateId) {
    return [] as LocationNode[];
  }

  const areaNodes = getLocationChildren(stateId);
  const cityIsState = normalizeToken(city) === normalizeToken(stateName);
  const matches = new Map<string, LocationNode>();

  for (const node of areaNodes) {
    if (area && nodeMatchesArtisanLocation(node, '', area)) {
      matches.set(node.id, node);
    }

    if (city && !cityIsState && nodeMatchesArtisanLocation(node, city, area || '')) {
      matches.set(node.id, node);
    }
  }

  return [...matches.values()];
}

function scoreAreaNode(node: LocationNode, city: string, area: string) {
  const cityToken = normalizeToken(city);
  const areaToken = normalizeToken(area);
  const labelToken = normalizeToken(node.label);
  let score = node.label.length;

  if (areaToken && labelToken === areaToken) {
    score += 100;
  }

  if (cityToken && labelToken === cityToken) {
    score += 80;
  }

  if (areaToken && node.aliases.some((alias) => normalizeToken(alias) === areaToken)) {
    score += 50;
  }

  if (cityToken && node.aliases.some((alias) => normalizeToken(alias) === cityToken)) {
    score += 40;
  }

  return score;
}

function findBestAreaMatch(stateName: string, city: string, area: string) {
  const matches = findMatchingAreaNodes(stateName, city, area);
  if (matches.length === 0) {
    return null;
  }

  const cityToken = normalizeToken(city);
  const areaToken = normalizeToken(area);
  const lookupToken = areaToken || cityToken;

  const canonicalMatches = matches.filter((node) => {
    if (node.label.length > 3) {
      return true;
    }

    const shortLabel = normalizeToken(node.label);
    return !matches.some(
      (other) =>
        other.id !== node.id &&
        other.label.length > node.label.length + 2 &&
        [other.label, ...other.aliases].some((value) => {
          const token = normalizeToken(value);
          return token === shortLabel || (lookupToken ? token === lookupToken : false);
        })
    );
  });

  const candidates = canonicalMatches.length > 0 ? canonicalMatches : matches;

  return candidates.sort((left, right) => scoreAreaNode(right, city, area) - scoreAreaNode(left, city, area))[0] ?? null;
}

export function normalizeArtisanProfileLocation(
  input: ArtisanLocationRecord
): ArtisanLocationNormalizationResult {
  const before: ArtisanLocationRecord = {
    city: input.city.trim(),
    area: input.area?.trim() ? input.area.trim() : null,
    lat: input.lat,
    lng: input.lng,
  };

  const city = before.city;
  const area = before.area ?? '';

  const stateName = resolveStateName(city, area, before.lat, before.lng);
  if (!stateName) {
    const after = { ...before };
    return {
      match: 'unchanged',
      reason: 'Could not resolve a Nigerian state from city, area, or coordinates.',
      locationId: null,
      before,
      after,
      changed: false,
    };
  }

  const stateId = stateIdForStateName(stateName);
  const matchedArea = findBestAreaMatch(stateName, city, area);
  const coords = pickCoordinates(before, stateName, matchedArea);

  if (matchedArea) {
    const after: ArtisanLocationRecord = {
      city: stateName,
      area: matchedArea.label,
      lat: coords.lat,
      lng: coords.lng,
    };

    return {
      match: 'area',
      reason: `Matched catalog area "${matchedArea.label}" in ${stateName}.`,
      locationId: matchedArea.id,
      before,
      after,
      changed: !recordsEqual(before, after),
    };
  }

  const after: ArtisanLocationRecord = {
    city: stateName,
    area: area || null,
    lat: coords.lat,
    lng: coords.lng,
  };

  const unchanged = recordsEqual(before, after);
  return {
    match: unchanged ? 'unchanged' : 'state_only',
    reason: area
      ? `Normalized state to ${stateName}; kept unmatched area "${area}".`
      : `Normalized state to ${stateName}.`,
    locationId: stateId,
    before,
    after,
    changed: !unchanged,
  };
}

export function locationIdForNormalizedResult(result: ArtisanLocationNormalizationResult) {
  if (result.locationId) {
    return result.locationId;
  }

  if (result.after.city && isKnownNigeriaState(result.after.city)) {
    return stateIdForStateName(result.after.city);
  }

  return null;
}

export function describeNormalizedLocation(result: ArtisanLocationNormalizationResult) {
  const locationId = locationIdForNormalizedResult(result);
  const node = locationId ? getLocationById(locationId) : null;
  return node?.label ?? result.after.area ?? result.after.city;
}
