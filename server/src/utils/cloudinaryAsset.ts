import { getConfiguredCloudinaryCloudName } from './cloudinaryUploadConfig';

const ALLOWED_RESOURCE_TYPES = new Set(['image', 'video', 'raw']);

/**
 * Validates that a client-supplied Cloudinary delivery URL belongs to this account.
 */
export function assertOwnedCloudinaryImageUrl(imageUrl: string, folderPrefix: string) {
  const cloudName = getConfiguredCloudinaryCloudName();
  let parsed: URL;

  try {
    parsed = new URL(imageUrl.trim());
  } catch {
    throw new Error('imageUrl must be a valid HTTPS URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('imageUrl must use HTTPS');
  }

  const expectedHost = `res.cloudinary.com`;
  if (parsed.hostname !== expectedHost) {
    throw new Error('imageUrl must be hosted on res.cloudinary.com');
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean);
  // /{cloud}/image/upload/{optional transforms}/{public_id}
  if (pathParts.length < 4 || pathParts[0] !== cloudName) {
    throw new Error('imageUrl does not match the configured Cloudinary cloud');
  }

  const resourceType = pathParts[1];
  if (!resourceType || !ALLOWED_RESOURCE_TYPES.has(resourceType)) {
    throw new Error('imageUrl must reference a Cloudinary image upload');
  }

  if (pathParts[2] !== 'upload') {
    throw new Error('imageUrl must be a Cloudinary upload URL');
  }

  const afterUpload = pathParts.slice(pathParts.indexOf('upload') + 1).join('/');
  const withoutVersion = afterUpload.replace(/^v\d+\//, '');
  const publicId = decodeURIComponent(withoutVersion.replace(/\.[^/.]+$/, ''));
  if (!publicId.startsWith(`${folderPrefix}/`)) {
    throw new Error(`imageUrl must be uploaded to the ${folderPrefix} folder`);
  }

  return publicId;
}

export function assertOwnedCloudinaryPublicId(
  cloudinaryId: string | undefined,
  folderPrefix: string,
  derivedPublicId?: string
) {
  if (!cloudinaryId?.trim()) {
    return;
  }

  const id = cloudinaryId.trim();
  if (!id.startsWith(`${folderPrefix}/`)) {
    throw new Error(`imageCloudinaryId must be under ${folderPrefix}`);
  }

  if (derivedPublicId && id !== derivedPublicId) {
    throw new Error('imageCloudinaryId does not match imageUrl');
  }
}
