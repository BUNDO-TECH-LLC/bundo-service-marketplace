import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cloudinaryUploadConfig', () => ({
  getConfiguredCloudinaryCloudName: () => 'test-cloud',
}));

describe('cloudinaryAsset', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('accepts a valid chat image URL', async () => {
    const { assertOwnedCloudinaryImageUrl } = await import('./cloudinaryAsset');
    const publicId = assertOwnedCloudinaryImageUrl(
      'https://res.cloudinary.com/test-cloud/image/upload/v1/bundo/chat-images/abc123.jpg',
      'bundo/chat-images'
    );
    expect(publicId).toBe('bundo/chat-images/abc123');
  });

  it('rejects external hosts', async () => {
    const { assertOwnedCloudinaryImageUrl } = await import('./cloudinaryAsset');
    expect(() =>
      assertOwnedCloudinaryImageUrl('https://evil.example/photo.jpg', 'bundo/chat-images')
    ).toThrow(/res\.cloudinary\.com/);
  });
});
