import { describe, it, expect } from 'vitest';
import { isFeatureEnabled, features } from '@/lib/features';

describe('features', () => {
  it('has all feature flags defined', () => {
    expect(features).toHaveProperty('voiceMessages');
    expect(features).toHaveProperty('reactions');
    expect(features).toHaveProperty('editableMessages');
    expect(features).toHaveProperty('replyToMessage');
    expect(features).toHaveProperty('pinMessages');
    expect(features).toHaveProperty('mentions');
    expect(features).toHaveProperty('emojiPicker');
    expect(features).toHaveProperty('dragDrop');
    expect(features).toHaveProperty('commandPalette');
    expect(features).toHaveProperty('analytics');
  });

  it('isFeatureEnabled returns correct values', () => {
    expect(isFeatureEnabled('voiceMessages')).toBe(true);
    expect(isFeatureEnabled('reactions')).toBe(true);
    expect(isFeatureEnabled('abTesting')).toBe(false);
  });

  it('isFeatureEnabled returns false for unknown flag', () => {
    expect(isFeatureEnabled('unknownFlag' as never)).toBe(false);
  });
});
