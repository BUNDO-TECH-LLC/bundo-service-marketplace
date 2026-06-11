import { describe, expect, it } from 'vitest';
import {
  buildCityOrStateWhere,
  buildNigeriaStateWhere,
  isKnownNigeriaState,
  normalizeArtisanCity,
  normalizeArtisanLocation,
  parseLocationFilters,
  resolveStateFromLocationInput,
} from './nigeriaStateFilter';

describe('nigeriaStateFilter', () => {
  it('recognises official state names', () => {
    expect(isKnownNigeriaState('Lagos')).toBe(true);
    expect(isKnownNigeriaState('FCT')).toBe(true);
    expect(isKnownNigeriaState('Paris')).toBe(false);
  });

  it('normalises major cities to their state', () => {
    expect(normalizeArtisanCity('Ikeja')).toBe('Lagos');
    expect(normalizeArtisanCity('Port Harcourt')).toBe('Rivers');
    expect(normalizeArtisanCity('Abuja')).toBe('FCT');
    expect(normalizeArtisanCity('Surulere')).toBe('Lagos');
    expect(normalizeArtisanCity('Lekki')).toBe('Lagos');
  });

  it('uses GPS to infer state when city text is unknown', () => {
    expect(normalizeArtisanLocation('Somewhere Local', 6.5244, 3.3792)).toBe('Lagos');
    expect(normalizeArtisanLocation('Lekki', 6.5244, 3.3792)).toBe('Lagos');
  });

  it('keeps unknown free-text cities unchanged without GPS', () => {
    expect(normalizeArtisanCity('Somewhere New')).toBe('Somewhere New');
    expect(normalizeArtisanLocation('Somewhere New')).toBe('Somewhere New');
  });

  it('resolves state from either query param', () => {
    expect(resolveStateFromLocationInput('Lagos')).toBe('Lagos');
    expect(resolveStateFromLocationInput(undefined, 'Ikeja')).toBe('Lagos');
    expect(resolveStateFromLocationInput('Ikeja')).toBe('Lagos');
    expect(resolveStateFromLocationInput(undefined, 'Somewhere New')).toBeUndefined();
  });

  it('parses API location filters preferring state matches', () => {
    expect(parseLocationFilters('Lagos', 'Ikeja')).toEqual({ state: 'Lagos' });
    expect(parseLocationFilters(undefined, 'Port Harcourt')).toEqual({ state: 'Rivers' });
    expect(parseLocationFilters(undefined, 'Somewhere New')).toEqual({ city: 'Somewhere New' });
  });

  it('builds OR filters for city, area, and coordinates', () => {
    const where = buildNigeriaStateWhere('Lagos');
    expect(where.OR).toBeDefined();
    expect(Array.isArray(where.OR)).toBe(true);
    expect((where.OR ?? []).length).toBeGreaterThan(10);
  });

  it('matches legacy neighbourhood names via buildCityOrStateWhere', () => {
    const where = buildCityOrStateWhere('Surulere');
    expect(where.OR).toBeDefined();
    expect(JSON.stringify(where)).toContain('Surulere');
    expect(JSON.stringify(where)).toContain('Lekki');
  });
});
