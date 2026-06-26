import { describe, expect, it } from 'vitest';
import { resolveArtisanLocationInput } from './resolveArtisanLocationInput';

describe('resolveArtisanLocationInput', () => {
  it('resolves catalog location ids to canonical city and area', () => {
    expect(
      resolveArtisanLocationInput({
        locationId: 'lagos-ikeja',
      })
    ).toMatchObject({
      city: 'Lagos',
      area: 'Ikeja',
      lat: expect.any(Number),
      lng: expect.any(Number),
    });
  });

  it('falls back to city and coordinates when no location id is provided', () => {
    expect(
      resolveArtisanLocationInput({
        city: 'Lagos',
        area: 'Lekki',
        lat: 6.5244,
        lng: 3.3792,
      })
    ).toEqual({
      city: 'Lagos',
      area: 'Lekki',
      lat: 6.5244,
      lng: 3.3792,
    });
  });
});
