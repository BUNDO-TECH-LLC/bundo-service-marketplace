export function slugifyLocationToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function stateLocationId(stateName: string) {
  const slug = slugifyLocationToken(stateName);
  return slug ? `state-${slug}` : '';
}

export function formatBrowseLocationLabel(state: string, area?: string | null) {
  const trimmedState = state.trim();
  const trimmedArea = area?.trim() ?? '';

  if (trimmedArea && trimmedState) {
    return `${trimmedArea}, ${trimmedState}`;
  }

  return trimmedState || 'Nigeria';
}

export function browseLocationPlaceholder(isDetectingLocation: boolean) {
  return isDetectingLocation ? 'Detecting…' : 'Select location';
}
