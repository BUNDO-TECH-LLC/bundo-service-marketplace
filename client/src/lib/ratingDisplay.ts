export function formatStarDisplay(avgRating: number, maxStars = 5) {
  const filled = Math.round(Math.max(0, Math.min(maxStars, avgRating)));
  return `${'★'.repeat(filled)}${'☆'.repeat(maxStars - filled)}`;
}
