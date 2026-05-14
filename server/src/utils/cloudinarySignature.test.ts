import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildCloudinaryUploadSignature } from './cloudinarySignature';

describe('buildCloudinaryUploadSignature', () => {
  it('sorts parameters alphabetically before signing', () => {
    const secret = 'test_secret';
    const sigOrdered = buildCloudinaryUploadSignature(
      { folder: 'bundo/x', timestamp: 1700000000 },
      secret
    );
    const sigReversed = buildCloudinaryUploadSignature(
      { timestamp: 1700000000, folder: 'bundo/x' },
      secret
    );
    expect(sigOrdered).toBe(sigReversed);
  });

  it('matches explicit Cloudinary string-to-sign shape', () => {
    const secret = 's3cr3t';
    const signature = buildCloudinaryUploadSignature(
      { folder: 'bundo/artisan-portfolio', timestamp: 99 },
      secret
    );
    const manual = crypto
      .createHash('sha1')
      .update(`folder=bundo/artisan-portfolio&timestamp=99${secret}`)
      .digest('hex');
    expect(signature).toBe(manual);
  });
});
