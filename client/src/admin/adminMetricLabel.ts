export function adminMetricLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, (value) => value.toUpperCase());
}