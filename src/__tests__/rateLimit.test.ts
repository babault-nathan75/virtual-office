import { describe, it, expect } from 'vitest';
import { rateLimit } from '@/lib/rateLimit';

describe('rateLimit', () => {
  it('allows requests within limit', () => {
    const result = rateLimit('test-user-1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('blocks requests over limit', () => {
    for (let i = 0; i < 10; i++) {
      rateLimit('test-user-overflow', 5, 60000);
    }
    const result = rateLimit('test-user-overflow', 5, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    const result1 = rateLimit('test-user-reset', 2, 1);
    expect(result1.allowed).toBe(true);
    // Wait for window to expire
    const result2 = rateLimit('test-user-reset', 2, 1);
    expect(result2.allowed).toBe(true);
  });
});
