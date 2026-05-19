import { api } from './api';
import { assertAcceptableImageFile } from './imageFile';
import type { CloudinarySignedUpload } from '../types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadKycImage(token: string, file: File): Promise<string> {
  assertAcceptableImageFile(file);

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Each image must be 5MB or smaller.');
  }

  const signatureResponse = await api<{ upload: CloudinarySignedUpload }>('/artisans/kyc/sign-upload', {
    method: 'POST',
    token,
  });

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
    secure_url?: string;
    error?: { message?: string };
  };

  if (!uploadResponse.ok) {
    throw new Error(uploadData?.error?.message || 'Could not upload document to storage');
  }

  if (!uploadData.secure_url) {
    throw new Error('Upload succeeded but the document URL was missing. Try again.');
  }

  return uploadData.secure_url;
}
