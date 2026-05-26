import { describe, expect, it } from 'vitest';
import { validateEmailFormat, validateSignupEmail } from './emailValidation.service';

describe('validateSignupEmail', () => {
  it('rejects malformed addresses', async () => {
    await expect(validateSignupEmail('not-an-email')).rejects.toThrow(/valid email/i);
  });
});

describe('validateEmailFormat', () => {
  it('normalizes valid addresses without DNS lookup', () => {
    expect(validateEmailFormat(' User@Example.COM ')).toEqual({
      email: 'user@example.com',
      domain: 'example.com',
    });
  });

  it('rejects malformed addresses', () => {
    expect(() => validateEmailFormat('not-an-email')).toThrow(/valid email/i);
  });
});
