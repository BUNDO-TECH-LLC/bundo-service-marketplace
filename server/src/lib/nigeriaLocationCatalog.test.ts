import { describe, expect, it } from 'vitest';
import {
  buildCatalogAreaWhere,
  findAreaNode,
  getLocationById,
  resolveLocationFiltersFromId,
  searchLocationNodes,
  stateIdForStateName,
} from './nigeriaLocationCatalog';

describe('nigeriaLocationCatalog', () => {
  it('resolves state and area filters from location ids', () => {
    expect(resolveLocationFiltersFromId('state-lagos')).toEqual({
      state: 'Lagos',
      lat: expect.any(Number),
      lng: expect.any(Number),
    });

    const ikeja = getLocationById('lagos-ikeja');
    expect(ikeja?.state).toBe('Lagos');
    expect(resolveLocationFiltersFromId('lagos-ikeja')).toMatchObject({
      state: 'Lagos',
      area: 'Ikeja',
    });
  });

  it('finds area nodes from labels and builds artisan filters', () => {
    const node = findAreaNode('Lagos', 'Ikeja');
    expect(node?.label).toBe('Ikeja');

    const where = buildCatalogAreaWhere('Lagos', 'Ikeja');
    expect(where.OR).toBeDefined();
    expect(JSON.stringify(where)).toContain('Ikeja');
  });

  it('searches states and areas by query', () => {
    const results = searchLocationNodes('ikeja');
    expect(results.some((node) => node.id === 'lagos-ikeja')).toBe(true);
  });

  it('maps canonical state names to ids', () => {
    expect(stateIdForStateName('FCT')).toBe('state-fct');
    expect(stateIdForStateName('Lagos')).toBe('state-lagos');
  });

  it('keeps short alias labels off the catalog as separate nodes', () => {
    expect(getLocationById('rivers-ph')).toBeNull();
    expect(getLocationById('lagos-vi')).toBeNull();

    const portHarcourt = getLocationById('rivers-port-harcourt');
    expect(portHarcourt?.aliases).toContain('PH');

    const victoriaIsland = getLocationById('lagos-victoria-island');
    expect(victoriaIsland?.aliases).toContain('VI');
  });
});
