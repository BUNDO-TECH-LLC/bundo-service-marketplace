type CloudinaryUploadErrorBody = {
  error?: { message?: string };
};

export function formatCloudinaryUploadError(
  cloudName: string,
  uploadData: CloudinaryUploadErrorBody,
  fallback: string
): string {
  const message = uploadData?.error?.message?.trim();

  if (message && /invalid cloud_name/i.test(message)) {
    return `Image upload failed: the API server is using Cloudinary cloud name "${cloudName}", which is invalid. Update CLOUDINARY_CLOUD_NAME on the API server (Render), save, trigger a manual redeploy, then try again. Refreshing the browser alone is not enough.`;
  }

  if (message && /invalid signature/i.test(message)) {
    return `Image upload failed: Cloudinary rejected the upload signature. Confirm CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the API server match the same Cloudinary account as CLOUDINARY_CLOUD_NAME, then redeploy.`;
  }

  return message || fallback;
}
