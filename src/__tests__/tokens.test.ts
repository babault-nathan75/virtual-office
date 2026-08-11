import { describe, it, expect } from 'vitest';
import { designTokens } from '@/lib/tokens';

describe('designTokens', () => {
  it('has typography scales', () => {
    expect(designTokens.typography).toHaveProperty('xs');
    expect(designTokens.typography).toHaveProperty('3xl');
  });

  it('has spacing values', () => {
    expect(designTokens.spacing['1']).toBe('4px');
    expect(designTokens.spacing['4']).toBe('16px');
  });

  it('has radius presets', () => {
    expect(designTokens.radius.sm).toBe('rounded-lg');
    expect(designTokens.radius.md).toBe('rounded-xl');
    expect(designTokens.radius.lg).toBe('rounded-2xl');
    expect(designTokens.radius.full).toBe('rounded-full');
  });

  it('has animation config', () => {
    expect(designTokens.animation.fast).toBe('duration-150');
    expect(designTokens.animation.normal).toBe('duration-200');
    expect(designTokens.animation.slow).toBe('duration-300');
    expect(designTokens.animation.easing).toBe('ease-out');
  });
});
