/** Apply Cloudinary delivery transforms for lighter gallery/profile images. */
export function optimizeCloudinaryUrl(url: string, width = 800) {
  const trimmed = url.trim();
  if (!trimmed.includes('res.cloudinary.com/') || !trimmed.includes('/upload/')) {
    return trimmed;
  }

  const [prefix, suffix] = trimmed.split('/upload/');
  if (!suffix || suffix.startsWith('f_auto,q_auto')) {
    return trimmed;
  }

  return `${prefix}/upload/f_auto,q_auto,w_${width}/${suffix}`;
}
