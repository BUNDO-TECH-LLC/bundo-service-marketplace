import { describe, expect, it } from 'vitest';
import { formatStarDisplay } from './ratingDisplay';

describe('formatStarDisplay', () => {
  it('rounds to the nearest star count', () => {
    expect(formatStarDisplay(4.6)).toBe('★★★★★');
    expect(formatStarDisplay(4.4)).toBe('★★★★☆');
    expect(formatStarDisplay(0)).toBe('☆☆☆☆☆');
  });
});
