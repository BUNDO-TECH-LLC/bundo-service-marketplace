import { api } from './api';
import { formatCloudinaryUploadError } from './cloudinaryUploadError';
import { assertAcceptableImageFile } from './imageFile';
import type { CloudinarySignedUpload, PortfolioImage } from '../types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadPortfolioImage(
  token: string,
  file: File,
  displayOrder: number
): Promise<PortfolioImage> {
  assertAcceptableImageFile(file);

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Each image must be 5MB or smaller.');
  }

  const signatureResponse = await api<{ upload: CloudinarySignedUpload }>(
    '/artisans/portfolio-images/sign-upload',
    { method: 'POST', token }
  );

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signatureResponse.upload.apiKey);
  formData.append('timestamp', String(signatureResponse.upload.timestamp));
  formData.append('folder', signatureResponse.upload.folder);
  formData.append('signature', signatureResponse.upload.signature);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureResponse.upload.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );
  const uploadData = (await uploadResponse.json()) as {
    public_id?: string;
    secure_url?: string;
    error?: { message?: string };
  };

  if (!uploadResponse.ok) {
    throw new Error(
      formatCloudinaryUploadError(
        signatureResponse.upload.cloudName,
        uploadData,
        'Could not upload image to storage'
      )
    );
  }

  if (!uploadData.public_id || !uploadData.secure_url) {
    throw new Error('Upload succeeded but the image URL was missing. Try again.');
  }

  const response = await api<{ image: PortfolioImage }>('/artisans/portfolio-images', {
    method: 'POST',
    token,
    body: JSON.stringify({
      cloudinaryId: uploadData.public_id,
      url: uploadData.secure_url,
      displayOrder: Math.max(0, Math.floor(displayOrder)),
    }),
  });

  return response.image;
}
