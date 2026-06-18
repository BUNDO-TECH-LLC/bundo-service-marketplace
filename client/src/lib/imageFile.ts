const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i;

/** Mobile browsers often leave `file.type` empty for camera-roll photos. */
export function isAcceptableImageFile(file: File) {
  if (file.type.startsWith('image/')) {
    return true;
  }

  if (!file.type && IMAGE_EXTENSIONS.test(file.name)) {
    return true;
  }

  return false;
}

export function assertAcceptableImageFile(file: File) {
  if (!isAcceptableImageFile(file)) {
    throw new Error('Please choose a JPG, PNG, or other image file.');
  }
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImageFileForPick(file: File, maxBytes = MAX_IMAGE_BYTES) {
  if (!isAcceptableImageFile(file)) {
    return 'Please choose a JPG, PNG, or other image file.';
  }

  if (file.size > maxBytes) {
    return `Image must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller.`;
  }

  return null;
}
