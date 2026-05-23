import { api } from './api';
import type { CloudinarySignedUpload, PortfolioImage } from '../types';

export const MAX_PORTFOLIO_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_GALLERY_IMAGES = 12;
export const PROFILE_DISPLAY_ORDER = 0;

export function validatePortfolioImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a JPG or PNG image.');
  }

  if (file.size > MAX_PORTFOLIO_FILE_BYTES) {
    throw new Error('Each image must be 5MB or smaller.');
  }
}

export function sortPortfolioImages(images: PortfolioImage[]) {
  return [...images].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function splitPortfolioImages(images: PortfolioImage[]) {
  const sorted = sortPortfolioImages(images);

  if (sorted.length === 0) {
    return { profileImage: null as PortfolioImage | null, galleryImages: [] as PortfolioImage[] };
  }

  const profileImage = sorted.find((image) => image.displayOrder === PROFILE_DISPLAY_ORDER) ?? sorted[0];
  const galleryImages = sorted.filter((image) => image.id !== profileImage.id).slice(0, MAX_GALLERY_IMAGES);

  return { profileImage, galleryImages };
}

export function nextGalleryDisplayOrder(images: PortfolioImage[]) {
  if (images.length === 0) {
    return PROFILE_DISPLAY_ORDER + 1;
  }

  return Math.max(...images.map((image) => image.displayOrder)) + 1;
}

export async function fetchMyPortfolioImages(token: string) {
  const response = await api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token });
  return sortPortfolioImages(response.images);
}

export async function uploadPortfolioImage(token: string, file: File, displayOrder: number) {
  validatePortfolioImageFile(file);

  const signatureResponse = await api<{ upload: CloudinarySignedUpload }>(
    '/artisans/portfolio-images/sign-upload',
    {
      method: 'POST',
      token,
    }
  );

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signatureResponse.upload.apiKey);
  formData.append('timestamp', String(signatureResponse.upload.timestamp));
  formData.append('folder', signatureResponse.upload.folder);
  formData.append('signature', signatureResponse.upload.signature);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureResponse.upload.cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const uploadData = await uploadResponse.json();

  if (!uploadResponse.ok) {
    throw new Error(uploadData?.error?.message || 'Could not upload image');
  }

  const created = await api<{ image: PortfolioImage }>('/artisans/portfolio-images', {
    method: 'POST',
    token,
    body: JSON.stringify({
      cloudinaryId: uploadData.public_id,
      url: uploadData.secure_url,
      displayOrder,
    }),
  });

  return created.image;
}

export async function deletePortfolioImage(token: string, imageId: string) {
  await api(`/artisans/portfolio-images/${imageId}`, {
    method: 'DELETE',
    token,
  });
}
