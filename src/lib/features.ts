export const features = {
  voiceMessages: true,
  reactions: true,
  editableMessages: true,
  replyToMessage: true,
  pinMessages: true,
  mentions: true,
  emojiPicker: true,
  dragDrop: true,
  commandPalette: true,
  abTesting: false,
  analytics: true,
} as const;

export type FeatureFlag = keyof typeof features;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return features[flag] ?? false;
}
