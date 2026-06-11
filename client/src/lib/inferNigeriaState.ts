import { distanceKm } from './distanceKm';
import { nigeriaStateCoordinates } from './nigeriaStateCoordinates';

/** Map GPS coordinates to the nearest Nigerian state (by state-hub distance). */
export function inferNigeriaState(lat: number, lng: number): string {
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
