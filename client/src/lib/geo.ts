export { nigeriaStates } from '../constants/data';

/** Approximate map centers for browse filter areas (Lagos metro). */
const BROWSE_AREA_CENTERS: Record<string, { lat: number; lng: number }> = {
  '': { lat: 6.5244, lng: 3.3792 },
  'Lagos Island': { lat: 6.4541, lng: 3.3947 },
  'Victoria Island': { lat: 6.4281, lng: 3.4219 },
  Lekki: { lat: 6.4698, lng: 3.5852 },
  Ikeja: { lat: 6.6018, lng: 3.3515 },
  Surulere: { lat: 6.5009, lng: 3.3489 },
  Yaba: { lat: 6.5097, lng: 3.3711 },
};

export function browseAreaCenter(areaValue: string): { lat: number; lng: number } {
  return BROWSE_AREA_CENTERS[areaValue] ?? BROWSE_AREA_CENTERS[''];
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceFromBrowseArea(
  artisanLat: number | undefined,
  artisanLng: number | undefined,
  browseArea: string
): string | null {
  if (artisanLat == null || artisanLng == null || Number.isNaN(artisanLat) || Number.isNaN(artisanLng)) {
    return null;
  }
  const center = browseAreaCenter(browseArea);
  const km = haversineKm(artisanLat, artisanLng, center.lat, center.lng);
  if (!Number.isFinite(km) || km < 0) {
    return null;
  }
  if (km < 0.1) {
    return 'Less than 0.1 km away';
  }
  if (km < 10) {
    return `${km.toFixed(1)} km away`;
  }
  return `${Math.round(km)} km away`;
}
