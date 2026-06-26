import { describe, expect, it } from 'vitest';
import { normalizeArtisanProfileLocation } from './normalizeArtisanLocationCatalog';

describe('normalizeArtisanProfileLocation', () => {
  it('normalizes neighbourhood city text to canonical state and area', () => {
    const result = normalizeArtisanProfileLocation({
      city: 'Lekki',
      area: null,
      lat: 6.5244,
      lng: 3.3792,
    });

    expect(result.match).toBe('area');
    expect(result.after.city).toBe('Lagos');
    expect(result.after.area).toBe('Lekki');
    expect(result.locationId).toBe('lagos-lekki');
    expect(result.changed).toBe(true);
  });

  it('normalizes split state and area fields', () => {
    const result = normalizeArtisanProfileLocation({
      city: 'Lagos',
      area: 'ikeja',
      lat: 6.5244,
      lng: 3.3792,
    });

    expect(result.match).toBe('area');
    expect(result.after).toMatchObject({
      city: 'Lagos',
      area: 'Ikeja',
    });
  });

  it('keeps unmatched area text but canonicalizes state', () => {
    const result = normalizeArtisanProfileLocation({
      city: 'Somewhere New',
      area: 'Near the bridge',
      lat: 6.5244,
      lng: 3.3792,
    });

    expect(result.match).toBe('state_only');
    expect(result.after.city).toBe('Lagos');
    expect(result.after.area).toBe('Near the bridge');
    expect(result.changed).toBe(true);
  });

  it('leaves already-canonical records unchanged', () => {
    const result = normalizeArtisanProfileLocation({
      city: 'Lagos',
      area: 'Ikeja',
      lat: 6.6018,
      lng: 3.3515,
    });

    expect(result.match).toBe('area');
    expect(result.changed).toBe(false);
  });

  it('maps Port Harcourt aliases to Rivers catalog area', () => {
    const result = normalizeArtisanProfileLocation({
      city: 'PH',
      area: '',
      lat: 4.8156,
      lng: 7.0498,
    });

    expect(result.after.city).toBe('Rivers');
    expect(result.after.area).toBe('Port Harcourt');
  });
});
