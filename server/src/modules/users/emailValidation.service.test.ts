import { describe, expect, it } from 'vitest';
import { validateSignupEmail } from './emailValidation.service';

describe('validateSignupEmail', () => {
  it('rejects malformed addresses', async () => {
    await expect(validateSignupEmail('not-an-email')).rejects.toThrow(/valid email/i);
  });
});
