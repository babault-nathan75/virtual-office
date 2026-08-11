import { describe, it, expect } from 'vitest';

function getStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Faible' };
  if (score <= 2) return { score, label: 'Moyen' };
  if (score <= 3) return { score, label: 'Bon' };
  return { score, label: 'Excellent' };
}

describe('getStrength', () => {
  it('returns Faible for weak password', () => {
    const result = getStrength('abc');
    expect(result.label).toBe('Faible');
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('returns Moyen for medium password', () => {
    const result = getStrength('abcdef1');
    expect(result.label).toBe('Moyen');
  });

  it('returns Bon for good password', () => {
    const result = getStrength('Abcdef12');
    expect(result.label).toBe('Bon');
    expect(result.score).toBe(3);
  });

  it('returns Excellent for strong password', () => {
    const result = getStrength('Abcdef12!!');
    expect(result.label).toBe('Excellent');
    expect(result.score).toBe(5);
  });

  it('returns Faible for empty string', () => {
    const result = getStrength('');
    expect(result.label).toBe('Faible');
  });
});
