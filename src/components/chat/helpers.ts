/**
 * Fonctions pures de la messagerie.
 *
 * Aucune ne touche à React, au réseau ni au DOM : formatage de dates, lecture
 * d'une pièce jointe depuis une URL, conversion audio. C'est précisément la
 * partie qui méritait d'être testable, et qui ne l'était pas tant qu'elle
 * vivait dans le corps d'un composant de 4 000 lignes.
 */

import lamejs from 'lamejs';
import { LOCALE } from '@/lib/i18n';
import type { MessageAttachment } from './types';
import { CHAT_FILES_BUCKET, OPTIMISTIC_PREFIX, RECORDING_MIME_TYPES } from './constants';

export function makeOptimisticId() {
  return `${OPTIMISTIC_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isOptimistic(id: string) {
  return id.startsWith(OPTIMISTIC_PREFIX);
}


export function roleLabel(role: string) {
  if (role === "admin") return "Administration";
  if (role === "entreprise") return "Entreprise";
  return "Secrétaire";
}

export function roleDotClass(role: string) {
  if (role === "admin") return "bg-amber-500";
  if (role === "entreprise") return "bg-emerald-500";
  return "bg-blue-500";
}

export function rolePillClass(role: string) {
  if (role === "admin") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (role === "entreprise")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

export function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("") || "?"
  );
}

export function safeHttpUrl(value?: string | null) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function fileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : "Fichier";
  } catch {
    return "Fichier";
  }
}

export function inferFileType(url: string, fallback?: string | null) {
  if (fallback) return fallback;

  const extension = fileNameFromUrl(url).split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    webm: "audio/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain",
  };

  return extension
    ? mimeTypes[extension] || "application/octet-stream"
    : "application/octet-stream";
}

export function preferredRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  return (
    RECORDING_MIME_TYPES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) || ""
  );
}

export function audioFileExtension(mimeType: string) {
  const normalizedType = mimeType.toLowerCase();
  if (normalizedType.includes("mp4") || normalizedType.includes("aac")) {
    return "m4a";
  }
  if (normalizedType.includes("ogg")) return "ogg";
  if (normalizedType.includes("mpeg")) return "mp3";
  if (normalizedType.includes("wav")) return "wav";
  return "webm";
}

export async function convertBlobToMp3(blob: Blob): Promise<Blob> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, 192);

  const samplesPerChunk = 1152;
  const mp3Chunks: Int8Array[] = [];

  for (let i = 0; i < length; i += samplesPerChunk) {
    const end = Math.min(i + samplesPerChunk, length);

    if (channels === 2) {
      const left = new Int16Array(end - i);
      const right = new Int16Array(end - i);
      const leftFloat = audioBuffer.getChannelData(0);
      const rightFloat = audioBuffer.getChannelData(1);
      for (let j = 0; j < end - i; j++) {
        left[j] = Math.max(-32768, Math.min(32767, leftFloat[i + j] * 32768));
        right[j] = Math.max(-32768, Math.min(32767, rightFloat[i + j] * 32768));
      }
      const encoded = mp3Encoder.encodeBuffer(left, right);
      if (encoded.length > 0) mp3Chunks.push(encoded);
    } else {
      const mono = new Int16Array(end - i);
      const monoFloat = audioBuffer.getChannelData(0);
      for (let j = 0; j < end - i; j++) {
        mono[j] = Math.max(-32768, Math.min(32767, monoFloat[i + j] * 32768));
      }
      const encoded = mp3Encoder.encodeBuffer(mono);
      if (encoded.length > 0) mp3Chunks.push(encoded);
    }
  }

  const tail = mp3Encoder.flush();
  if (tail.length > 0) mp3Chunks.push(tail);

  const combined = new Uint8Array(mp3Chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const chunk of mp3Chunks) {
    combined.set(new Uint8Array(chunk.buffer), offset);
    offset += chunk.length;
  }

  return new Blob([combined], { type: "audio/mpeg" });
}

export function chatFilePathFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const marker = `/${CHAT_FILES_BUCKET}/`;
    const storagePrefix = "/storage/v1/object/";
    const prefixIndex = pathname.indexOf(storagePrefix);
    const bucketIndex = pathname.indexOf(marker, prefixIndex);

    if (prefixIndex === -1 || bucketIndex === -1) return null;

    const encodedPath = pathname.slice(bucketIndex + marker.length);
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

export function parseLegacyAttachment(content: string): MessageAttachment | null {
  const match = content.trim().match(/^(.*?)\s+[—–-]\s+(https?:\/\/\S+)\s*$/i);

  if (!match) return null;

  const url = safeHttpUrl(match[2]);
  if (!url) return null;

  const label = match[1].trim().replace(/^📎\s*/, "");
  const inferredType = inferFileType(url);
  const isVoice =
    inferredType.startsWith("audio/") || /message\s+vocal/i.test(label);

  return {
    url,
    type:
      isVoice && !inferredType.startsWith("audio/")
        ? "audio/webm"
        : inferredType,
    name: isVoice ? "Message vocal" : label || fileNameFromUrl(url),
    legacy: true,
  };
}

/**
 * Détecte une erreur PostgREST « colonne inconnue », afin de dégrader
 * proprement lorsqu'une migration n'a pas encore été appliquée en base.
 */
export function isMissingColumnError(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    (candidate.code === "PGRST204" || candidate.code === "42703") &&
    message.includes(column)
  );
}

export function resolveMessageAttachment(
  message: { content: string },
): MessageAttachment | null {
  return parseLegacyAttachment(message.content);
}

export function visibleMessageText(
  message: { content: string },
  attachment = resolveMessageAttachment(message),
) {
  const content = message.content.trim();
  if (!attachment) return content;
  if (parseLegacyAttachment(content)) return "";

  const isDefaultVoiceLabel = /^🎤?\s*message\s+vocal$/i.test(content);
  const isDefaultFileLabel =
    content === attachment.name;

  return isDefaultVoiceLabel || isDefaultFileLabel ? "" : content;
}

export function messagePreview(message: { content: string }) {
  const attachment = resolveMessageAttachment(message);
  if (!attachment) return message.content;
  if (attachment.type.startsWith("audio/")) return "🎤 Message vocal";
  if (attachment.type.startsWith("image/")) return `🖼️ ${attachment.name}`;
  return `📎 ${attachment.name}`;
}

export function formatConversationDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return "Hier";

  return date.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit" });
}

export function isSameDay(first: string, second: string) {
  const a = new Date(first);
  const b = new Date(second);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDayLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(value, now.toISOString())) return "Aujourd'hui";
  if (isSameDay(value, yesterday.toISOString())) return "Hier";

  return date.toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
