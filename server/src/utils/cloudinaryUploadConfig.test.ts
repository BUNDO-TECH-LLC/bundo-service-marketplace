import { describe, expect, it } from 'vitest';
import { normalizeCloudinaryCloudName } from './cloudinaryUploadConfig';

describe('normalizeCloudinaryCloudName', () => {
  it('trims whitespace', () => {
    expect(normalizeCloudinaryCloudName('  dmlxlf2ub  ')).toBe('dmlxlf2ub');
  });

  it('strips surrounding double quotes', () => {
    expect(normalizeCloudinaryCloudName('"dmlxlf2ub"')).toBe('dmlxlf2ub');
  });

  it('strips surrounding single quotes', () => {
    expect(normalizeCloudinaryCloudName("'dmlxlf2ub'")).toBe('dmlxlf2ub');
  });
});
