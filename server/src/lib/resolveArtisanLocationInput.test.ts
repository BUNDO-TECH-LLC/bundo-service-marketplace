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
      locationId: 'lagos-ikeja',
      lat: expect.any(Number),
      lng: expect.any(Number),
    });
  });

  it('resolves state and area text to catalog ids without coordinates', () => {
    expect(
      resolveArtisanLocationInput({
        city: 'Lagos',
        area: 'Lekki Phase 1',
      })
    ).toMatchObject({
      city: 'Lagos',
      area: 'Lekki Phase 1',
      locationId: 'lagos-lekki-phase-1',
    });
  });

  it('falls back to city and coordinates when no catalog match exists', () => {
    expect(
      resolveArtisanLocationInput({
        city: 'Lagos',
        area: 'Unknown Area',
        lat: 6.5244,
        lng: 3.3792,
      })
    ).toEqual({
      city: 'Lagos',
      area: 'Unknown Area',
      locationId: 'state-lagos',
      lat: 6.5244,
      lng: 3.3792,
    });
  });
});
