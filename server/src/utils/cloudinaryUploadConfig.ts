import { env } from '../config/env';
import { buildCloudinaryUploadSignature } from './cloudinarySignature';
import { httpError } from './errors';

const CLOUD_NAME_PATTERN = /^[a-z0-9-]+$/;
const CLOUD_CHECK_TTL_MS = 15 * 60 * 1000;

let cachedCloudCheck:
  | {
      checkedAt: number;
      cloudName: string;
      ok: boolean;
      error?: string;
    }
  | undefined;

export function normalizeCloudinaryCloudName(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getConfiguredCloudinaryCloudName(): string {
  return normalizeCloudinaryCloudName(env.CLOUDINARY_CLOUD_NAME);
}

function formatCloudNameError(cloudName: string, detail?: string): string {
  const suffix = detail ? ` (${detail})` : '';
  return `Cloudinary cloud name "${cloudName}" is invalid${suffix}. Set CLOUDINARY_CLOUD_NAME on the API server (Render dashboard → bundo-service-marketplace → Environment), save, then trigger a manual redeploy so the new value loads.`;
}

export async function verifyCloudinaryCloudName(
  cloudName = getConfiguredCloudinaryCloudName()
): Promise<{ ok: boolean; cloudName: string; error?: string }> {
  if (!CLOUD_NAME_PATTERN.test(cloudName)) {
    return {
      ok: false,
      cloudName,
      error: 'Cloud name must use lowercase letters, numbers, and hyphens only.',
    };
  }

  try {
    const response = await fetch(`https://res.cloudinary.com/${cloudName}/image/upload/sample.jpg`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return {
        ok: false,
        cloudName,
        error: `Cloudinary returned HTTP ${response.status} for this cloud name.`,
      };
    }

    return { ok: true, cloudName };
  } catch (error) {
    return {
      ok: false,
      cloudName,
      error: error instanceof Error ? error.message : 'Could not reach Cloudinary.',
    };
  }
}

export async function getCloudinaryHealth(force = false): Promise<{
  ok: boolean;
  cloudName: string;
  error?: string;
}> {
  const cloudName = getConfiguredCloudinaryCloudName();
  const now = Date.now();

  if (
    !force &&
    cachedCloudCheck &&
    cachedCloudCheck.cloudName === cloudName &&
    now - cachedCloudCheck.checkedAt < CLOUD_CHECK_TTL_MS
  ) {
    const cached: { ok: boolean; cloudName: string; error?: string } = {
      ok: cachedCloudCheck.ok,
      cloudName: cachedCloudCheck.cloudName,
    };
    if (cachedCloudCheck.error) {
      cached.error = cachedCloudCheck.error;
    }
    return cached;
  }

  const result = await verifyCloudinaryCloudName(cloudName);
  cachedCloudCheck = {
    checkedAt: now,
    cloudName: result.cloudName,
    ok: result.ok,
    ...(result.error ? { error: result.error } : {}),
  };

  const response: { ok: boolean; cloudName: string; error?: string } = {
    ok: result.ok,
    cloudName: result.cloudName,
  };
  if (result.error) {
    response.error = result.error;
  }
  return response;
}

export async function createCloudinarySignedUpload(folder: string) {
  const health = await getCloudinaryHealth();

  if (!health.ok) {
    throw httpError(503, formatCloudNameError(health.cloudName, health.error));
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildCloudinaryUploadSignature({ folder, timestamp }, env.CLOUDINARY_API_SECRET);

  return {
    cloudName: health.cloudName,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
  };
}
