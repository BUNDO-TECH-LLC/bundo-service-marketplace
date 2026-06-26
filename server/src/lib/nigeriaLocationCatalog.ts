import type { Prisma } from '@prisma/client';
import {
  isKnownNigeriaState,
  majorCitiesByState,
  nigeriaStateCoordinates,
  normalizeArtisanCity,
} from './nigeriaStateFilter';
import { ALIAS_ONLY_AREA_LABELS, FCT_AREAS, LAGOS_AREAS } from './lagosAbujaAreas';

export type LocationKind = 'country' | 'state' | 'area';

export type LocationNode = {
  id: string;
  kind: LocationKind;
  label: string;
  parentId: string | null;
  state?: string;
  area?: string;
  lat: number;
  lng: number;
  aliases: string[];
  popular?: boolean;
};

export const NIGERIA_ROOT_ID = 'nigeria';

export const POPULAR_STATE_NAMES = ['FCT', 'Lagos', 'Ogun', 'Oyo', 'Rivers'] as const;

const EXTRA_AREAS_BY_STATE: Partial<Record<string, string[]>> = {
  Lagos: [...LAGOS_AREAS],
  FCT: [...FCT_AREAS],
  Rivers: ['Trans Amadi', 'GRA', 'Elelenwo', 'Rumuola', 'Diobu'],
  Oyo: ['Bodija', 'Molete', 'Challenge', 'Apata'],
  Ogun: ['Sagamu', 'Ota', 'Ijebu Ode', 'Agbara'],
};

const AREA_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'lagos-lekki-phase-1': { lat: 6.4474, lng: 3.4722 },
  'lagos-lekki-phase-2': { lat: 6.4392, lng: 3.5089 },
  'lagos-victoria-island': { lat: 6.4281, lng: 3.4219 },
  'lagos-ikoyi': { lat: 6.4541, lng: 3.4346 },
  'lagos-ajah': { lat: 6.4675, lng: 3.6015 },
  'lagos-surulere': { lat: 6.4969, lng: 3.3584 },
  'lagos-yaba': { lat: 6.5158, lng: 3.3811 },
  'lagos-ikeja': { lat: 6.6018, lng: 3.3515 },
  'lagos-lekki': { lat: 6.4474, lng: 3.5562 },
  'fct-abuja': { lat: 9.0579, lng: 7.4951 },
  'fct-garki': { lat: 9.04, lng: 7.4898 },
  'fct-wuse': { lat: 9.0765, lng: 7.4896 },
  'fct-maitama': { lat: 9.0833, lng: 7.4958 },
  'fct-asokoro': { lat: 9.0458, lng: 7.5319 },
  'fct-kubwa': { lat: 9.0092, lng: 7.3958 },
  'fct-gwarinpa': { lat: 9.1081, lng: 7.3989 },
  'fct-lugbe': { lat: 8.9964, lng: 7.3678 },
  'fct-nyanya': { lat: 8.9967, lng: 7.5644 },
  'fct-karu': { lat: 8.9989, lng: 7.6133 },
  'fct-jabi': { lat: 9.0764, lng: 7.4278 },
  'rivers-port-harcourt': { lat: 4.8156, lng: 7.0498 },
  'oyo-ibadan': { lat: 7.3775, lng: 3.947 },
  'ogun-abeokuta': { lat: 7.1608, lng: 3.3481 },
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) {
      continue;
    }

    const key = normalizeToken(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function areaAliases(label: string, stateName: string) {
  const aliases = [label];
  if (normalizeToken(label) === 'port harcourt') {
    aliases.push('PH', 'Port Harcourt');
  }
  if (normalizeToken(label) === 'abuja') {
    aliases.push('FCT');
  }
  if (normalizeToken(label) === 'victoria island') {
    aliases.push('VI');
  }
  if (normalizeToken(label) !== normalizeToken(stateName)) {
    aliases.push(stateName);
  }
  return uniqueLabels(aliases);
}

function buildCatalog(): Map<string, LocationNode> {
  const nodes = new Map<string, LocationNode>();

  nodes.set(NIGERIA_ROOT_ID, {
    id: NIGERIA_ROOT_ID,
    kind: 'country',
    label: 'Nigeria',
    parentId: null,
    lat: 9.082,
    lng: 8.6753,
    aliases: ['Nigeria'],
  });

  for (const stateName of Object.keys(nigeriaStateCoordinates)) {
    const stateSlug = slugify(stateName);
    const stateId = `state-${stateSlug}`;
    const hub = nigeriaStateCoordinates[stateName]!;

    nodes.set(stateId, {
      id: stateId,
      kind: 'state',
      label: stateName,
      parentId: NIGERIA_ROOT_ID,
      state: stateName,
      lat: hub.lat,
      lng: hub.lng,
      aliases: uniqueLabels([stateName, ...(majorCitiesByState[stateName] ?? [])]),
      popular: POPULAR_STATE_NAMES.includes(stateName as (typeof POPULAR_STATE_NAMES)[number]),
    });

    const areaLabels = uniqueLabels([
      ...(majorCitiesByState[stateName] ?? []),
      ...(EXTRA_AREAS_BY_STATE[stateName] ?? []),
    ]).filter((label) => normalizeToken(label) !== normalizeToken(stateName))
      .filter((label) => !ALIAS_ONLY_AREA_LABELS.has(normalizeToken(label)));

    for (const areaLabel of areaLabels) {
      const areaId = `${stateSlug}-${slugify(areaLabel)}`;
      if (nodes.has(areaId)) {
        continue;
      }

      const coords = AREA_COORDINATES[areaId] ?? hub;
      nodes.set(areaId, {
        id: areaId,
        kind: 'area',
        label: areaLabel,
        parentId: stateId,
        state: stateName,
        area: areaLabel,
        lat: coords.lat,
        lng: coords.lng,
        aliases: areaAliases(areaLabel, stateName),
      });
    }
  }

  return nodes;
}

const catalog = buildCatalog();

export function getLocationById(locationId: string): LocationNode | null {
  return catalog.get(locationId) ?? null;
}

export function getLocationChildren(parentId: string): LocationNode[] {
  return [...catalog.values()]
    .filter((node) => node.parentId === parentId)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getAllStateNodes(): LocationNode[] {
  return getLocationChildren(NIGERIA_ROOT_ID);
}

export function getPopularStateNodes(): LocationNode[] {
  return POPULAR_STATE_NAMES.map((stateName) => getLocationById(`state-${slugify(stateName)}`)).filter(
    (node): node is LocationNode => Boolean(node)
  );
}

export function searchLocationNodes(query: string, limit = 20): LocationNode[] {
  const token = normalizeToken(query);
  if (!token) {
    return [];
  }

  return [...catalog.values()]
    .filter((node) => node.kind !== 'country')
    .filter((node) => {
      const haystack = [node.label, ...node.aliases].map(normalizeToken);
      return haystack.some((label) => label.includes(token) || token.includes(label));
    })
    .sort((left, right) => {
      const leftExact = normalizeToken(left.label) === token ? 0 : 1;
      const rightExact = normalizeToken(right.label) === token ? 0 : 1;
      if (leftExact !== rightExact) {
        return leftExact - rightExact;
      }

      if (left.kind !== right.kind) {
        return left.kind === 'state' ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, limit);
}

export type ResolvedLocationFilters = {
  state?: string;
  area?: string;
  lat?: number;
  lng?: number;
};

export function resolveLocationFiltersFromId(locationId: string): ResolvedLocationFilters {
  const node = getLocationById(locationId);
  if (!node || node.kind === 'country') {
    return {};
  }

  if (node.kind === 'state' && node.state) {
    return {
      state: node.state,
      lat: node.lat,
      lng: node.lng,
    };
  }

  if (node.kind === 'area' && node.state) {
    return {
      state: node.state,
      area: node.area ?? node.label,
      lat: node.lat,
      lng: node.lng,
    };
  }

  return {};
}

export function stateIdForStateName(stateName: string) {
  if (!isKnownNigeriaState(stateName)) {
    return null;
  }

  return `state-${slugify(stateName)}`;
}

export function findAreaNode(stateName: string, areaLabel: string): LocationNode | null {
  const stateId = stateIdForStateName(stateName);
  if (!stateId) {
    return null;
  }

  const token = normalizeToken(areaLabel);
  const children = getLocationChildren(stateId);
  let bestMatch: { node: LocationNode; score: number } | null = null;

  for (const node of children) {
    const labels = [node.label, ...(node.aliases ?? [])].map(normalizeToken);

    for (const label of labels) {
      if (label === token) {
        return node;
      }

      if (label.includes(token) || token.includes(label)) {
        const score = label.length;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { node, score };
        }
      }
    }
  }

  return bestMatch?.node ?? null;
}

export function buildCatalogAreaWhere(state: string, areaLabel: string): Prisma.ArtisanProfileWhereInput {
  const node = findAreaNode(state, areaLabel);
  const labels = uniqueLabels(node ? [node.label, ...node.aliases] : [areaLabel]);

  return {
    OR: labels.flatMap((label) => [
      { city: { equals: label, mode: 'insensitive' as const } },
      { city: { contains: label, mode: 'insensitive' as const } },
      { area: { equals: label, mode: 'insensitive' as const } },
      { area: { contains: label, mode: 'insensitive' as const } },
    ]),
  };
}

export function resolveArtisanState(city: string, area?: string | null) {
  const fromCity = normalizeArtisanCity(city);
  if (isKnownNigeriaState(fromCity)) {
    return fromCity;
  }

  if (area?.trim()) {
    const fromArea = normalizeArtisanCity(area);
    if (isKnownNigeriaState(fromArea)) {
      return fromArea;
    }
  }

  return null;
}

export function matchArtisanToAreaNode(
  city: string,
  area: string | null | undefined,
  nodes: LocationNode[]
): LocationNode | null {
  const cityToken = normalizeToken(city);
  const areaToken = area?.trim() ? normalizeToken(area) : '';

  for (const node of nodes) {
    const aliases = [node.label, ...node.aliases].map(normalizeToken);
    const matchesCity = cityToken && aliases.some((alias) => alias === cityToken || cityToken.includes(alias) || alias.includes(cityToken));
    const matchesArea =
      areaToken && aliases.some((alias) => alias === areaToken || areaToken.includes(alias) || alias.includes(areaToken));

    if (matchesCity || matchesArea) {
      return node;
    }
  }

  return null;
}

export function locationLabelForNode(node: LocationNode) {
  if (node.kind === 'state' && node.state) {
    return node.state;
  }

  if (node.kind === 'area' && node.state) {
    return `${node.label}, ${node.state}`;
  }

  return node.label;
}
