import { describe, expect, it } from 'vitest';
import { computePaystackSignatureHex } from './paystack.service';

describe('computePaystackSignatureHex', () => {
  it('returns a 128-char hex string for SHA-512 HMAC', () => {
    const hex = computePaystackSignatureHex('{"event":"charge.success"}', 'sk_test_secret');
    expect(hex).toMatch(/^[0-9a-f]{128}$/);
  });

  it('is deterministic for the same inputs', () => {
    const body = '{"a":1}';
    const secret = 'sk_test';
    expect(computePaystackSignatureHex(body, secret)).toBe(computePaystackSignatureHex(body, secret));
  });
});
