/**
 * Constantes de la messagerie.
 *
 * Regroupées pour être ajustables en un seul endroit — et lisibles depuis les
 * tests, ce qu'interdisait leur emplacement au milieu de `ChatWindow.tsx`.
 */

export const OPTIMISTIC_PREFIX = 'optimistic-';

export const PAGE_SIZE = 30;
export const EPHEMERAL_OPTIONS = [
  { label: "5 min", ms: 5 * 60 * 1000 },
  { label: "1 h", ms: 60 * 60 * 1000 },
  { label: "24 h", ms: 24 * 60 * 60 * 1000 },
];

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
export const CHAT_FILES_BUCKET = "chat-files";
export const RECORDING_MIME_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/ogg",
] as const;
