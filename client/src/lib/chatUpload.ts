import { api } from './api';
import { assertAcceptableImageFile } from './imageFile';
import type { CloudinarySignedUpload } from '../types';

export async function uploadChatImage(token: string, file: File) {
  assertAcceptableImageFile(file);

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Chat images must be 5MB or smaller.');
  }

  const signatureResponse = await api<{ upload: CloudinarySignedUpload }>('/messages/sign-upload', {
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
    {
      method: 'POST',
      body: formData,
    }
  );
  const uploadData = await uploadResponse.json();

  if (!uploadResponse.ok) {
    throw new Error(uploadData?.error?.message || 'Could not upload image');
  }

  return {
    imageUrl: uploadData.secure_url as string,
    imageCloudinaryId: uploadData.public_id as string,
  };
}
