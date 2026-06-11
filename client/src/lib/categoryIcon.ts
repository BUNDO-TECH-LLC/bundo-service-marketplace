const CATEGORY_ICON_GLYPHS: Record<string, string> = {
  ac: '❄',
  carpentry: '⊞',
  plumbing: '⚙',
  cleaning: '⌂',
  appliance: '▣',
  beautician: '✦',
  masonry: '▦',
  electrical: '⚡',
  generator: '▤',
  haulage: '⛟',
  barbing: '✂',
  broom: '⌂',
  cake: '◐',
  camera: '◉',
  needle: '⌁',
  scissors: '✂',
  sparkles: '✦',
  wrench: '⚙',
  service: '■',
};

export function categoryIcon(iconKey?: string) {
  return CATEGORY_ICON_GLYPHS[iconKey || ''] || '■';
}
