import { describe, expect, it } from 'vitest';
import { inferNigeriaState } from './inferNigeriaState';
import { nigeriaStateCoordinates } from './nigeriaStateCoordinates';

describe('inferNigeriaState', () => {
  it('maps Lagos coordinates to Lagos', () => {
    const { lat, lng } = nigeriaStateCoordinates.Lagos;
    expect(inferNigeriaState(lat, lng)).toBe('Lagos');
  });

  it('maps Abuja coordinates to FCT', () => {
    const { lat, lng } = nigeriaStateCoordinates.FCT;
    expect(inferNigeriaState(lat, lng)).toBe('FCT');
  });

  it('falls back to Lagos for invalid coordinates', () => {
    expect(inferNigeriaState(Number.NaN, Number.NaN)).toBe('Lagos');
  });
});
