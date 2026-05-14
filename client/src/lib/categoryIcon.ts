export function categoryIcon(iconKey?: string) {
  const icons: Record<string, string> = {
    broom: '▤',
    cake: '◐',
    camera: '◉',
    needle: '⌁',
    scissors: '✂',
    sparkles: '✦',
    wrench: '⌁',
  };

  return icons[iconKey || ''] || '■';
}
