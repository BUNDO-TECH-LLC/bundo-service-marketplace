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
