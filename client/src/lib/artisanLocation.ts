import { browseLocationAreaOptions, nigeriaStates } from '../constants/data';
import { browseAreaCenter } from './geo';

export type ParsedArtisanLocation = {
  city: string;
  area: string;
  lat: number;
  lng: number;
};

export type LocationValidationResult =
  | { ok: true; value: ParsedArtisanLocation }
  | { ok: false; message: string };

function normalizeInput(raw: string): string {
  return raw.trim().replace(/,?\s*nigeria\s*$/i, '').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findState(text: string): { state: string; index: number } | null {
  let match: { state: string; index: number } | null = null;

  for (const state of nigeriaStates) {
    const pattern = new RegExp(`\\b${escapeRegExp(state)}\\b`, 'i');
    const found = pattern.exec(text);

    if (found && (!match || found.index > match.index)) {
      match = { state, index: found.index };
    }
  }

  return match;
}

function resolveAreaPart(normalized: string, state: string, stateIndex: number): string {
  const beforeState = normalized.slice(0, stateIndex).replace(/[,\s]+$/, '').trim();

  if (beforeState.length >= 2 && !/^\d+$/.test(beforeState)) {
    return beforeState;
  }

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    const last = parts[parts.length - 1];

    if (last.toLowerCase() === state.toLowerCase()) {
      const area = parts.slice(0, -1).join(', ').trim();
      if (area.length >= 2 && !/^\d+$/.test(area)) {
        return area;
      }
    }
  }

  const withoutState = normalized
    .replace(new RegExp(`\\b${escapeRegExp(state)}\\b`, 'i'), '')
    .replace(/[,\s]+/g, ' ')
    .trim();

  return withoutState;
}

function coordsForArea(area: string, override?: { lat: number; lng: number } | null) {
  if (override) {
    return override;
  }

  const known = browseLocationAreaOptions.find(
    (option) =>
      option.value &&
      (option.label.toLowerCase() === area.toLowerCase() ||
        area.toLowerCase().includes(option.value.toLowerCase()))
  );

  return known?.value ? browseAreaCenter(known.value) : browseAreaCenter('');
}

export function parseArtisanLocation(
  raw: string,
  coords?: { lat: number; lng: number } | null
): LocationValidationResult {
  const normalized = normalizeInput(raw);

  if (normalized.length < 8) {
    return { ok: false, message: 'Enter your area and state (e.g. Lekki, Lagos).' };
  }

  const found = findState(normalized);

  if (!found) {
    return { ok: false, message: 'Include a Nigerian state (e.g. Lagos, Oyo, FCT).' };
  }

  const area = resolveAreaPart(normalized, found.state, found.index);

  if (!area) {
    return { ok: false, message: 'Include your area or neighborhood before the state.' };
  }

  const { lat, lng } = coordsForArea(area, coords);

  return {
    ok: true,
    value: {
      city: found.state,
      area,
      lat,
      lng,
    },
  };
}

export function requestDeviceCoordinates(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(error.message || 'Could not access your location.'));
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}
