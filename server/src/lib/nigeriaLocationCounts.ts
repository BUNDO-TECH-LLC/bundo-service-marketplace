import { VerifyStatus } from '@prisma/client';
import db from '../db/client';
import {
  getAllStateNodes,
  getLocationById,
  getLocationChildren,
  matchArtisanToAreaNode,
  NIGERIA_ROOT_ID,
  resolveArtisanState,
  searchLocationNodes,
  type LocationNode,
} from './nigeriaLocationCatalog';

export type LocationListItem = {
  id: string;
  label: string;
  kind: LocationNode['kind'];
  parentId: string | null;
  state?: string | undefined;
  area?: string | undefined;
  lat: number;
  lng: number;
  count: number;
  hasChildren: boolean;
};

type ArtisanLocationRow = {
  city: string;
  area: string | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedRows: { expiresAt: number; rows: ArtisanLocationRow[] } | null = null;
const countCache = new Map<string, { expiresAt: number; items: LocationListItem[] }>();

async function loadArtisanLocationRows(): Promise<ArtisanLocationRow[]> {
  const now = Date.now();
  if (cachedRows && cachedRows.expiresAt > now) {
    return cachedRows.rows;
  }

  const offerings = await db.offering.findMany({
    where: {
      artisan: {
        verifyStatus: VerifyStatus.APPROVED,
      },
    },
    select: {
      artisan: {
        select: {
          city: true,
          area: true,
        },
      },
    },
  });

  const rows = offerings.map((row) => ({
    city: row.artisan.city,
    area: row.artisan.area,
  }));

  cachedRows = {
    expiresAt: now + CACHE_TTL_MS,
    rows,
  };

  return rows;
}

function countRowsForState(rows: ArtisanLocationRow[], stateName: string) {
  return rows.filter((row) => resolveArtisanState(row.city, row.area) === stateName).length;
}

function toListItem(
  node: Pick<LocationNode, 'id' | 'label' | 'kind' | 'parentId' | 'state' | 'area' | 'lat' | 'lng'>,
  count: number,
  hasChildren: boolean,
  label?: string
): LocationListItem {
  return {
    id: node.id,
    label: label ?? node.label,
    kind: node.kind,
    parentId: node.parentId,
    state: node.state,
    area: node.area,
    lat: node.lat,
    lng: node.lng,
    count,
    hasChildren,
  };
}

function buildStateListing(rows: ArtisanLocationRow[]): LocationListItem[] {
  const popularIds = new Set(['state-fct', 'state-lagos', 'state-ogun', 'state-oyo', 'state-rivers']);
  const states = getAllStateNodes();

  const items = states.map((node) => ({
    ...toListItem(node, countRowsForState(rows, node.state ?? node.label), getLocationChildren(node.id).length > 0),
    popular: popularIds.has(node.id),
  }));

  items.sort((left, right) => {
    const leftPopular = 'popular' in left && left.popular ? 0 : 1;
    const rightPopular = 'popular' in right && right.popular ? 0 : 1;
    if (leftPopular !== rightPopular) {
      return leftPopular - rightPopular;
    }

    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.label.localeCompare(right.label);
  });

  return items.map(({ popular: _popular, ...item }) => item);
}

function buildAreaListing(parentId: string, rows: ArtisanLocationRow[]): LocationListItem[] {
  const parent = getLocationById(parentId);
  if (!parent || parent.kind !== 'state' || !parent.state) {
    return [];
  }

  const stateRows = rows.filter((row) => resolveArtisanState(row.city, row.area) === parent.state);
  const areaNodes = getLocationChildren(parentId);
  const areaCounts = new Map<string, number>();

  for (const node of areaNodes) {
    areaCounts.set(node.id, 0);
  }

  for (const row of stateRows) {
    const matched = matchArtisanToAreaNode(row.city, row.area, areaNodes);
    if (matched) {
      areaCounts.set(matched.id, (areaCounts.get(matched.id) ?? 0) + 1);
    }
  }

  const allStateItem = toListItem(
    parent,
    stateRows.length,
    false,
    `All ${parent.label} State`
  );

  const areaItems = areaNodes.map((node) =>
    toListItem(node, areaCounts.get(node.id) ?? 0, false)
  );

  areaItems.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.label.localeCompare(right.label);
  });

  return [allStateItem, ...areaItems];
}

function buildSearchListing(query: string, rows: ArtisanLocationRow[]): LocationListItem[] {
  const matches = searchLocationNodes(query, 25);

  return matches.map((node) => {
    if (node.kind === 'state' && node.state) {
      return toListItem(node, countRowsForState(rows, node.state), getLocationChildren(node.id).length > 0);
    }

    const stateName = node.state ?? '';
    const stateRows = stateName
      ? rows.filter((row) => resolveArtisanState(row.city, row.area) === stateName)
      : [];

    return toListItem(
      node,
      stateRows.filter((row) => matchArtisanToAreaNode(row.city, row.area, [node])).length,
      node.kind === 'state' && getLocationChildren(node.id).length > 0,
      node.kind === 'area' && node.state ? `${node.label}, ${node.state}` : node.label
    );
  });
}

export async function listLocations(options: {
  parent?: string;
  q?: string;
}): Promise<{ parentId: string; items: LocationListItem[] }> {
  const parentId = options.parent?.trim() || NIGERIA_ROOT_ID;
  const query = options.q?.trim() ?? '';
  const cacheKey = query ? `search:${query.toLowerCase()}` : `parent:${parentId}`;
  const now = Date.now();
  const cached = countCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return { parentId: query ? NIGERIA_ROOT_ID : parentId, items: cached.items };
  }

  const rows = await loadArtisanLocationRows();
  const items = query
    ? buildSearchListing(query, rows)
    : parentId === NIGERIA_ROOT_ID
      ? buildStateListing(rows)
      : buildAreaListing(parentId, rows);

  countCache.set(cacheKey, {
    expiresAt: now + CACHE_TTL_MS,
    items,
  });

  return { parentId: query ? NIGERIA_ROOT_ID : parentId, items };
}
