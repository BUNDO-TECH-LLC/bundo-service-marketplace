import crypto from 'node:crypto';

/**
 * Cloudinary signed upload: SHA1 of sorted `key=value` pairs joined with `&`,
 * then the API secret appended (same algorithm as Cloudinary dashboard / SDK).
 * @see https://cloudinary.com/documentation/authentication_signatures
 */
export function buildCloudinaryUploadSignature(
  params: Record<string, string | number>,
  apiSecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramsToSign = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');

  return crypto
    .createHash('sha1')
    .update(`${paramsToSign}${apiSecret}`)
    .digest('hex');
}
