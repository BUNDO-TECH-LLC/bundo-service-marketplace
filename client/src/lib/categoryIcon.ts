export function categoryIcon(iconKey?: string) {
  const normalized = iconKey?.trim().toLowerCase();

  if (!normalized) {
    return 'solar:widget-5-bold';
  }

  if (normalized.includes(':')) {
    return normalized;
  }

  const icons: Record<string, string> = {
    broom: 'mdi:broom',
    cake: 'mdi:cake-variant-outline',
    camera: 'mdi:camera-outline',
    needle: 'mdi:needle',
    scissors: 'mdi:content-cut',
    sparkles: 'mdi:sparkles',
    wrench: 'mdi:hammer-wrench',
    service: 'solar:widget-5-bold',
    'hair-stylist': 'mdi:hair-dryer-outline',
    hs: 'mdi:hair-dryer-outline',
    plumbing: 'material-symbols:plumbing',
    pl: 'material-symbols:plumbing',
    cleaning: 'material-symbols:cleaning-services',
    cl: 'material-symbols:cleaning-services',
    carpentry: 'mdi:saw-blade',
    cp: 'mdi:saw-blade',
    photo: 'mdi:camera-outline',
    ph: 'mdi:camera-outline',
    painter: 'mdi:format-paint',
    pa: 'mdi:format-paint',
    courier: 'mdi:truck-fast-outline',
    co: 'mdi:truck-fast-outline',
  };

  return icons[normalized] || 'solar:widget-5-bold';
}
