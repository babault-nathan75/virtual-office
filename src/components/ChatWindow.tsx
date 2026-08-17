"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/Toast";
import { SkeletonChat } from "@/components/Skeleton";
import { isFeatureEnabled } from "@/lib/features";
import { useSwipeActions } from "@/hooks/useSwipeActions";
import lamejs from "lamejs";

type Message = {
  // UUID côté base, et non un entier : les identifiants de messages ne se
  // comparent ni ne s'incrémentent.
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  read_at: string | null;
  closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
  ephemeral: boolean;
  expires_at: string | null;
  created_at: string;
  // Message cité (migration 006). Optionnel : les bases antérieures à cette
  // migration renvoient simplement la colonne absente.
  reply_to?: string | null;
};

/*
 * Les messages en cours d'envoi reçoivent un identifiant local préfixé, seul
 * moyen de les distinguer des messages persistés maintenant que les vrais
 * identifiants sont des UUID. L'ancien procédé — un entier négatif comparé par
 * `id < 0` — reposait sur la coercition d'un UUID en NaN.
 */
const OPTIMISTIC_PREFIX = 'optimistic-';

function makeOptimisticId() {
  return `${OPTIMISTIC_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isOptimistic(id: string) {
  return id.startsWith(OPTIMISTIC_PREFIX);
}

type Conversation = {
  otherId: string;
  otherNom: string;
  otherRole: string;
  lastMessage: string;
  lastDate: string;
  unread: number;
  closed: boolean;
  closedBy: string | null;
};

type Profile = {
  id: string;
  nom: string;
  role: string;
  email?: string;
  telephone?: string;
};

type SearchHit = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ContactOption = {
  id: string;
  nom: string;
  role: string;
  email?: string;
};

type MessageAttachment = {
  url: string;
  type: string;
  name: string;
  legacy: boolean;
};

type Props = {
  currentUserId: string;
  currentRole: "entreprise" | "secretaire" | "admin";
  /** @deprecated Conservé pour compatibilité ; les administrateurs sont désormais chargés depuis profils. */
  adminId?: string;
};

type ConfirmAction =
  | { kind: "closeConversation"; otherId: string };

const PAGE_SIZE = 30;
const EPHEMERAL_OPTIONS = [
  { label: "5 min", ms: 5 * 60 * 1000 },
  { label: "1 h", ms: 60 * 60 * 1000 },
  { label: "24 h", ms: 24 * 60 * 60 * 1000 },
];

const MAX_MESSAGE_LENGTH = 2000;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const CHAT_FILES_BUCKET = "chat-files";
const RECORDING_MIME_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/ogg",
] as const;

function roleLabel(role: string) {
  if (role === "admin") return "Administration";
  if (role === "entreprise") return "Entreprise";
  return "Secrétaire";
}

function roleDotClass(role: string) {
  if (role === "admin") return "bg-amber-500";
  if (role === "entreprise") return "bg-emerald-500";
  return "bg-blue-500";
}

function rolePillClass(role: string) {
  if (role === "admin") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (role === "entreprise")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

function getInitials(name: string) {
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

function safeHttpUrl(value?: string | null) {
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

function fileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : "Fichier";
  } catch {
    return "Fichier";
  }
}

function inferFileType(url: string, fallback?: string | null) {
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

function preferredRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  return (
    RECORDING_MIME_TYPES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) || ""
  );
}

function audioFileExtension(mimeType: string) {
  const normalizedType = mimeType.toLowerCase();
  if (normalizedType.includes("mp4") || normalizedType.includes("aac")) {
    return "m4a";
  }
  if (normalizedType.includes("ogg")) return "ogg";
  if (normalizedType.includes("mpeg")) return "mp3";
  if (normalizedType.includes("wav")) return "wav";
  return "webm";
}

async function convertBlobToMp3(blob: Blob): Promise<Blob> {
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

function chatFilePathFromUrl(url: string) {
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

function parseLegacyAttachment(content: string): MessageAttachment | null {
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
function isMissingColumnError(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    (candidate.code === "PGRST204" || candidate.code === "42703") &&
    message.includes(column)
  );
}

function resolveMessageAttachment(
  message: { content: string },
): MessageAttachment | null {
  return parseLegacyAttachment(message.content);
}

function visibleMessageText(
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

function messagePreview(message: { content: string }) {
  const attachment = resolveMessageAttachment(message);
  if (!attachment) return message.content;
  if (attachment.type.startsWith("audio/")) return "🎤 Message vocal";
  if (attachment.type.startsWith("image/")) return `🖼️ ${attachment.name}`;
  return `📎 ${attachment.name}`;
}

function formatConversationDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("fr-FR", {
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

  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function isSameDay(first: string, second: string) {
  const a = new Date(first);
  const b = new Date(second);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(value, now.toISOString())) return "Aujourd'hui";
  if (isSameDay(value, yesterday.toISOString())) return "Hier";

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default function ChatWindow({ currentUserId, currentRole }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [downloadingAttachmentUrl, setDownloadingAttachmentUrl] = useState<
    string | null
  >(null);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ContactOption[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(
    new Map(),
  );
  const [isTyping, setIsTyping] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<
    { id: string; nom: string; role: string }[]
  >([]);
  const [msgSearchResults, setMsgSearchResults] = useState<SearchHit[]>([]);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [ephemeralMode, setEphemeralMode] = useState<number | null>(null);
  const [activeMessageActions, setActiveMessageActions] = useState<
    string | null
  >(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");
  const [recording, setRecording] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null,
  );
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const recordingMimeTypeRef = useRef("audio/webm;codecs=opus");
  const setAudioChunks = (chunks: Blob[]) => {
    audioChunksRef.current = chunks;
  };
  const [currentUserName, setCurrentUserName] = useState("Utilisateur");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const userSearchRequestRef = useRef(0);
  const messageSearchRequestRef = useRef(0);
  const draftsRef = useRef<Map<string, string>>(new Map());

  const {
    offset: swipeOffset,
    onTouchStart: swipeStart,
    onTouchMove: swipeMove,
    onTouchEnd: swipeEnd,
  } = useSwipeActions({
    onSwipeLeft: () => {
      if (recording) return;
      if (selectedConv && !selectedConv.closed) {
        setConfirmAction({
          kind: "closeConversation",
          otherId: selectedConv.otherId,
        });
      }
    },
    onSwipeRight: () => {
      if (recording) return;
      if (selectedConv?.closed) void reopenConversation(selectedConv.otherId);
    },
  });

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const selectedConversationId = selectedConv?.otherId ?? null;
  const canContactRole = useCallback(
    (role: string) => currentRole === "admin" || role === "admin",
    [currentRole],
  );

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("profils")
      .select("nom")
      .eq("id", currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nom) setCurrentUserName(data.nom);
      });
  }, [currentUserId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (confirmAction && !confirmingAction) {
        setConfirmAction(null);
        return;
      }

      if (showProfile) {
        setShowProfile(false);
        return;
      }

      setShowConversationMenu(false);
      setActiveMessageActions(null);
      setShowMentions(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [confirmAction, confirmingAction, showProfile]);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) {
      setConversations([]);
      return;
    }

    const baseColumns =
      "id, sender_id, receiver_id, content, read, closed, closed_by, created_at, ephemeral, expires_at";
    const loadConversationMessages = (columns: string) =>
      supabase
        .from("messages")
        .select(columns)
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false });

    const response = await loadConversationMessages(baseColumns);

    if (response.error) {
      console.error("[ChatWindow] fetchConversations error:", response.error);
      throw response.error;
    }

    const allMessages = response.data as unknown as { id: number; sender_id: string; receiver_id: string; content: string; read: boolean; closed: boolean; closed_by: string | null; created_at: string; ephemeral: boolean | null; expires_at: string | null }[] | null;

    const convMap = new Map<
      string,
      {
        lastMessage: string;
        lastDate: string;
        unread: number;
        closed: boolean;
        closedBy: string | null;
      }
    >();

    for (const message of allMessages ?? []) {
      const isExpired =
        message.ephemeral &&
        message.expires_at &&
        new Date(message.expires_at) < new Date();
      if (isExpired) continue;

      const otherId =
        message.sender_id === currentUserId
          ? message.receiver_id
          : message.sender_id;
      const existing = convMap.get(otherId);
      const unread =
        message.receiver_id === currentUserId && !message.read ? 1 : 0;

      if (!existing) {
        convMap.set(otherId, {
          lastMessage: messagePreview(message),
          lastDate: message.created_at,
          unread,
          closed: message.closed,
          closedBy: message.closed_by,
        });
      } else if (unread > 0) {
        convMap.set(otherId, {
          ...existing,
          unread: existing.unread + unread,
        });
      }
    }

    const otherIds = Array.from(convMap.keys());

    if (otherIds.length === 0) {
      setConversations([]);
      setSelectedConv(null);
      return;
    }

    const { data: profils, error: profilsError } = await supabase
      .from("profils_publics")
      .select("id, nom, role")
      .in("id", otherIds);

    if (profilsError) {
      console.error("[ChatWindow] profils error:", profilsError);
      throw profilsError;
    }

    const profilMap = new Map<
      string,
      {
        nom: string;
        role: string;
      }
    >(
      (profils ?? []).map((profile) => [
        profile.id,
        {
          nom: profile.nom,
          role: profile.role,
        },
      ]),
    );

    const convs: Conversation[] = otherIds
      .map((id) => ({
        otherId: id,
        otherNom: profilMap.get(id)?.nom ?? "Utilisateur",
        otherRole: profilMap.get(id)?.role ?? "secretaire",
        ...convMap.get(id)!,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime(),
      );

    setConversations(convs);
    setSelectedConv((previous) => {
      if (!previous) return previous;
      return (
        convs.find((conv) => conv.otherId === previous.otherId) ?? previous
      );
    });
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;

    const loadConversations = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        await fetchConversations();
      } catch (err) {
        console.error("[ChatWindow] loadConversations error:", err);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadConversations();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, fetchConversations]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`conv-list:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id === currentUserId || m.receiver_id === currentUserId)
            fetchConversations();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id === currentUserId || m.receiver_id === currentUserId)
            fetchConversations();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchConversations]);

  useEffect(() => {
    if (!currentUserId) return;

    const profileChannel = supabase
      .channel(`chat-profiles:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profils" },
        (payload) => {
          const updated = payload.new as Profile;

          setConversations((previous) =>
            previous.map((conv) =>
              conv.otherId === updated.id
                ? {
                    ...conv,
                    otherNom: updated.nom ?? conv.otherNom,
                    otherRole: updated.role ?? conv.otherRole,
                  }
                : conv,
            ),
          );

          setSelectedConv((previous) =>
            previous?.otherId === updated.id
              ? {
                  ...previous,
                  otherNom: updated.nom ?? previous.otherNom,
                  otherRole: updated.role ?? previous.otherRole,
                }
              : previous,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileChannel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !selectedConversationId) {
      setMessages([]);
      setLoadingMessages(false);
      setHasMoreMessages(false);
      return;
    }

    let cancelled = false;
    setMessages([]);
    setLoadingMessages(true);
    setHasMoreMessages(false);

    const belongsToConversation = (message: Message) =>
      (message.sender_id === currentUserId &&
        message.receiver_id === selectedConversationId) ||
      (message.sender_id === selectedConversationId &&
        message.receiver_id === currentUserId);

    const openConversation = async () => {
      const { data: msgs, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedConversationId}),and(sender_id.eq.${selectedConversationId},receiver_id.eq.${currentUserId})`,
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (messagesError) {
        console.error("[ChatWindow] openConversation error:", messagesError);
        toast.error("Impossible de charger cette conversation.");
        if (!cancelled) {
          setMessages([]);
          setLoadingMessages(false);
        }
        return;
      }

      if (!cancelled) {
        setMessages((msgs ?? []).reverse() as Message[]);
        setHasMoreMessages((msgs?.length ?? 0) === PAGE_SIZE);
        setLoadingMessages(false);
        window.setTimeout(() => scrollToBottom(false), 50);
      }

      const { error: readError } = await supabase
        .from("messages")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("receiver_id", currentUserId)
        .eq("sender_id", selectedConversationId)
        .eq("read", false);

      if (readError) {
        console.warn("[ChatWindow] read status error:", readError.message);
      }

      if (!cancelled) {
        setConversations((previous) =>
          previous.map((conv) =>
            conv.otherId === selectedConversationId
              ? { ...conv, unread: 0 }
              : conv,
          ),
        );
      }
    };

    void openConversation();

    const typingKey = [currentUserId, selectedConversationId].sort().join(":");
    const typingChannel = supabase
      .channel(`typing:${typingKey}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const data = payload.payload as {
          userId: string;
          name: string;
          typing: boolean;
        };

        if (data.userId === currentUserId) return;

        setTypingUsers((previous) => {
          const next = new Map(previous);
          if (data.typing) next.set(data.userId, data.name);
          else next.delete(data.userId);
          return next;
        });
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    const msgChannel = supabase
      .channel(`chat:${typingKey}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const inserted = payload.new as Message;
          if (!belongsToConversation(inserted)) return;

          setMessages((previous) => {
            if (previous.some((message) => message.id === inserted.id)) {
              return previous;
            }
            return [...previous, inserted];
          });

          window.setTimeout(scrollToBottom, 100);

          if (inserted.sender_id !== currentUserId) {
            void supabase
              .from("messages")
              .update({ read: true, read_at: new Date().toISOString() })
              .eq("id", inserted.id);

            setConversations((previous) =>
              previous.map((conv) =>
                conv.otherId === selectedConversationId
                  ? { ...conv, unread: 0 }
                  : conv,
              ),
            );

            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "granted" &&
              document.visibilityState !== "visible"
            ) {
              new Notification("Secrétariat Pro", {
                body: inserted.content.slice(0, 100),
                icon: "/icon-192.png",
              });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const updated = payload.new as Message;
          if (!belongsToConversation(updated)) return;

          setMessages((previous) =>
            previous.map((message) =>
              message.id === updated.id ? { ...message, ...updated } : message,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      typingChannelRef.current = null;
      void supabase.removeChannel(msgChannel);
      void supabase.removeChannel(typingChannel);
      setTypingUsers(new Map());
    };
  }, [currentUserId, selectedConversationId, scrollToBottom]);

  const loadOlder = async () => {
    if (
      !selectedConv ||
      messages.length === 0 ||
      loadingOlder ||
      !hasMoreMessages
    )
      return;

    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight ?? 0;
    setLoadingOlder(true);
    const oldest = messages[0];
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedConv.otherId}),and(sender_id.eq.${selectedConv.otherId},receiver_id.eq.${currentUserId})`,
        )
        .lt("created_at", oldest.created_at)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      const olderMessages = (data ?? []).reverse() as Message[];
      setHasMoreMessages(olderMessages.length === PAGE_SIZE);

      if (olderMessages.length > 0) {
        setMessages((previous) => [...olderMessages, ...previous]);
        window.requestAnimationFrame(() => {
          if (!container) return;
          container.scrollTop = container.scrollHeight - previousScrollHeight;
        });
      }
    } catch (error) {
      console.error("[ChatWindow] loadOlder error:", error);
      toast.error("Les anciens messages n'ont pas pu être chargés.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleTyping = () => {
    if (!selectedConv || !typingChannelRef.current) return;

    if (!isTyping) {
      setIsTyping(true);
      void typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: currentUserId,
          name: currentUserName,
          typing: true,
        },
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (!typingChannelRef.current) return;

      void typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: currentUserId,
          name: currentUserName,
          typing: false,
        },
      });
    }, 1800);
  };

  const sendMessage = async () => {
    const contentToSend = newMessage.trim();
    if (!contentToSend || !selectedConv || sending || selectedConv.closed)
      return;
    if (!canContactRole(selectedConv.otherRole)) {
      toast.error("Vous pouvez uniquement contacter un administrateur.");
      return;
    }

    setSending(true);
    const currentEphemeralMode = ephemeralMode;
    // Capturé avant la remise à zéro de `replyingTo` juste en dessous.
    const replyToId = replyingTo?.id ?? null;

    setNewMessage("");
    draftsRef.current.delete(selectedConv.otherId);
    setEphemeralMode(null);
    setReplyingTo(null);
    window.requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.style.height = "auto";
      inputRef.current.focus();
    });

    const optimisticMsg: Message = {
      id: makeOptimisticId(),
      sender_id: currentUserId,
      receiver_id: selectedConv.otherId,
      content: contentToSend,
      read: false,
      read_at: null,
      closed: false,
      closed_by: null,
      closed_at: null,
      ephemeral: currentEphemeralMode !== null,
      expires_at: currentEphemeralMode
        ? new Date(Date.now() + currentEphemeralMode).toISOString()
        : null,
      created_at: new Date().toISOString(),
      reply_to: replyToId,
    };

    setMessages((previous) => [...previous, optimisticMsg]);
    scrollToBottom();

    const insertData: Record<string, unknown> = {
      sender_id: currentUserId,
      receiver_id: selectedConv.otherId,
      content: contentToSend,
      read: false,
    };

    if (currentEphemeralMode !== null) {
      insertData.ephemeral = true;
      insertData.expires_at = new Date(
        Date.now() + currentEphemeralMode,
      ).toISOString();
    }

    // On ne cite qu'un message déjà persisté : un message optimiste n'existe
    // pas encore en base et ne peut pas être référencé.
    if (replyToId !== null && !isOptimistic(replyToId)) {
      insertData.reply_to = replyToId;
    }

    try {
      let { data, error } = await supabase
        .from("messages")
        .insert(insertData)
        .select("*")
        .single();

      // Repli si la migration 006 n'a pas encore été appliquée : le message
      // part sans sa citation plutôt que d'échouer complètement.
      if (error && isMissingColumnError(error, "reply_to")) {
        delete insertData.reply_to;
        ({ data, error } = await supabase
          .from("messages")
          .insert(insertData)
          .select("*")
          .single());
      }

      if (error) throw error;

      const persisted = data as Message;
      setMessages((previous) => {
        const withoutDuplicates = previous.filter(
          (message) =>
            message.id !== optimisticMsg.id && message.id !== persisted.id,
        );

        return [...withoutDuplicates, persisted].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      });

      void fetchConversations();
    } catch (error) {
      console.error("[ChatWindow] sendMessage error:", error);
      toast.error("Le message n'a pas pu être envoyé.");
      setMessages((previous) =>
        previous.filter((message) => message.id !== optimisticMsg.id),
      );
      setNewMessage(contentToSend);
      window.requestAnimationFrame(() => {
        if (!inputRef.current) return;
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        inputRef.current.focus();
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const insertAttachmentMessage = async ({
    receiverId,
    content,
    fileUrl,
  }: {
    receiverId: string;
    content: string;
    fileUrl: string;
  }) => {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: currentUserId,
        receiver_id: receiverId,
        content: `${content} — ${fileUrl}`,
        read: false,
      })
      .select("id, sender_id, receiver_id, content, read, read_at, closed, closed_by, closed_at, created_at")
      .single();

    if (error || !data) {
      throw error ?? new Error("Message non enregistré");
    }

    return data as Message;
  };

  const uploadFile = async (file: File) => {
    if (!selectedConv || selectedConv.closed || uploadingFile) return;
    if (!canContactRole(selectedConv.otherRole)) {
      toast.error("Vous pouvez uniquement contacter un administrateur.");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error("Le fichier dépasse la limite de 10 Mo.");
      return;
    }

    setUploadingFile(true);
    const extension = file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase()
      : "bin";
    const uniqueSuffix = Math.random().toString(36).slice(2, 10);
    const path = `${currentUserId}/${Date.now()}-${uniqueSuffix}.${extension || "bin"}`;
    let storedPath: string | null = null;

    try {
      const { data, error: uploadError } = await supabase.storage
        .from(CHAT_FILES_BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) throw uploadError;
      storedPath = data.path;

      const { data: urlData } = supabase.storage
        .from(CHAT_FILES_BUCKET)
        .getPublicUrl(data.path);

      const messageData = await insertAttachmentMessage({
        receiverId: selectedConv.otherId,
        content: file.name,
        fileUrl: urlData.publicUrl,
      });

      setMessages((previous) =>
        previous.some((message) => message.id === messageData.id)
          ? previous
          : [...previous, messageData],
      );

      storedPath = null;
      scrollToBottom();
      void fetchConversations();
      toast.success("Fichier envoyé.");
    } catch (error) {
      console.error("[ChatWindow] uploadFile error:", error);
      if (storedPath) {
        void supabase.storage.from(CHAT_FILES_BUCKET).remove([storedPath]);
      }
      toast.error("Le fichier n'a pas pu être envoyé.");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file);
  };

  const downloadAttachment = async (attachment: MessageAttachment) => {
    if (downloadingAttachmentUrl) return;

    const safeUrl = safeHttpUrl(attachment.url);
    if (!safeUrl) {
      toast.error("Le lien de ce fichier n'est pas valide.");
      return;
    }

    setDownloadingAttachmentUrl(safeUrl);

    try {
      let fileBlob: Blob | null = null;
      const storagePath = chatFilePathFromUrl(safeUrl);

      if (storagePath) {
        const { data, error } = await supabase.storage
          .from(CHAT_FILES_BUCKET)
          .download(storagePath);
        if (error) throw error;
        fileBlob = data;
      } else {
        const response = await fetch(safeUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        fileBlob = await response.blob();
      }

      if (!fileBlob || fileBlob.size === 0) {
        throw new Error("Fichier vide");
      }

      const objectUrl = URL.createObjectURL(fileBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = attachment.name || fileNameFromUrl(safeUrl);
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success("Fichier enregistré.");
    } catch (error) {
      console.error("[ChatWindow] downloadAttachment error:", error);
      toast.error("Le fichier n'a pas pu être téléchargé.");
    } finally {
      setDownloadingAttachmentUrl(null);
    }
  };

  const searchUsers = async (term: string) => {
    setSearchTerm(term);
    const normalizedTerm = term.trim();
    const requestId = ++userSearchRequestRef.current;
    setSearchingUsers(true);

    try {
      let profilesQuery = supabase
        .from("profils_publics")
        .select("id, nom, role")
        .neq("id", currentUserId)
        .in(
          "role",
          currentRole === "admin"
            ? ["admin", "entreprise", "secretaire"]
            : ["admin"],
        );

      if (normalizedTerm) {
        profilesQuery = profilesQuery.ilike("nom", `%${normalizedTerm}%`);
      }

      const { data, error } = await profilesQuery
        .order("nom", { ascending: true })
        .limit(20);

      if (error) throw error;
      if (requestId !== userSearchRequestRef.current) return;

      setSearchResults(
        (data ?? []).map((profile) => ({
          id: profile.id,
          nom: profile.nom,
          role: profile.role,
        })),
      );
    } catch (error) {
      console.error("[ChatWindow] searchUsers error:", error);
      if (requestId === userSearchRequestRef.current) setSearchResults([]);
    } finally {
      if (requestId === userSearchRequestRef.current) setSearchingUsers(false);
    }
  };

  const openNewConversationPicker = () => {
    setShowNewConv(true);
    setSearchTerm("");
    setSearchResults([]);
    void searchUsers("");
  };

  const closeNewConversationPicker = () => {
    userSearchRequestRef.current += 1;
    setShowNewConv(false);
    setSearchTerm("");
    setSearchResults([]);
    setSearchingUsers(false);
  };

  const toggleNewConversationPicker = () => {
    if (showNewConv) {
      closeNewConversationPicker();
    } else {
      openNewConversationPicker();
    }
  };

  const startNewConversation = (user: ContactOption) => {
    if (!canContactRole(user.role)) {
      toast.error("Vous pouvez uniquement contacter un administrateur.");
      return;
    }

    if (recording) {
      toast.error(
        "Terminez l'enregistrement vocal avant de changer de discussion.",
      );
      return;
    }

    if (selectedConv) {
      draftsRef.current.set(selectedConv.otherId, newMessage);
    }

    const conv: Conversation = {
      otherId: user.id,
      otherNom: user.nom,
      otherRole: user.role,
      lastMessage: "",
      lastDate: "",
      unread: 0,
      closed: false,
      closedBy: null,
    };
    setConversations((prev) => {
      if (prev.some((c) => c.otherId === user.id)) return prev;
      return [conv, ...prev];
    });
    setSelectedConv(conv);
    setNewMessage(draftsRef.current.get(user.id) ?? "");
    setReplyingTo(null);
    setEditingMsg(null);
    closeNewConversationPicker();
    window.setTimeout(() => inputRef.current?.focus(), 120);
  };

  const closeConversation = async (otherId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({
        closed: true,
        closed_by: currentUserId,
        closed_at: new Date().toISOString(),
      })
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUserId})`,
      )
      .eq("closed", false);
    if (error) {
      toast.error("Impossible de fermer la discussion.");
      return false;
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.otherId === otherId
          ? { ...c, closed: true, closedBy: currentUserId }
          : c,
      ),
    );
    if (selectedConv?.otherId === otherId)
      setSelectedConv((prev) =>
        prev ? { ...prev, closed: true, closedBy: currentUserId } : null,
      );
    toast.success("Discussion fermée.");
    return true;
  };

  const reopenConversation = async (otherId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ closed: false, closed_by: null, closed_at: null })
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUserId})`,
      )
      .eq("closed", true);
    if (error) {
      toast.error("Erreur.");
      return;
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.otherId === otherId ? { ...c, closed: false, closedBy: null } : c,
      ),
    );
    if (selectedConv?.otherId === otherId)
      setSelectedConv((prev) =>
        prev ? { ...prev, closed: false, closedBy: null } : null,
      );
    toast.success("Discussion rouverte.");
  };

  const confirmPendingAction = async () => {
    if (!confirmAction || confirmingAction) return;

    setConfirmingAction(true);
    try {
      let succeeded = false;
      if (confirmAction.kind === "closeConversation") {
        succeeded = await closeConversation(confirmAction.otherId);
      }
      if (succeeded) setConfirmAction(null);
    } finally {
      setConfirmingAction(false);
    }
  };

  const loadProfile = async (userId: string) => {
    const conversation = conversations.find((c) => c.otherId === userId);

    setProfileLoading(true);
    setActiveProfile({
      id: userId,
      nom: conversation?.otherNom ?? selectedConv?.otherNom ?? "Utilisateur",
      role: conversation?.otherRole ?? selectedConv?.otherRole ?? "secretaire",
    });
    setShowProfile(true);

    const { data: fullProfile, error } = await supabase
      .from("profils_publics")
      .select("id, nom, role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[ChatWindow] loadProfile details unavailable:", error);
      setProfileLoading(false);
      return;
    }

    if (fullProfile) {
      setActiveProfile({
        id: fullProfile.id,
        nom: fullProfile.nom,
        role: fullProfile.role,
      });
    }

    setProfileLoading(false);
  };

  const searchMessages = async (q: string) => {
    setMsgSearch(q);
    const normalizedQuery = q.trim();
    const requestId = ++messageSearchRequestRef.current;

    if (normalizedQuery.length < 2 || !selectedConv) {
      setMsgSearchResults([]);
      setSearchingMessages(false);
      return;
    }

    setSearchingMessages(true);
    try {
      const response = await fetch(
        `/api/messages/search?userId=${encodeURIComponent(currentUserId)}&otherId=${encodeURIComponent(selectedConv.otherId)}&q=${encodeURIComponent(normalizedQuery)}`,
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (requestId === messageSearchRequestRef.current) {
        setMsgSearchResults(data.results || []);
      }
    } catch (error) {
      console.error("[ChatWindow] searchMessages error:", error);
      if (requestId === messageSearchRequestRef.current) {
        setMsgSearchResults([]);
      }
    } finally {
      if (requestId === messageSearchRequestRef.current) {
        setSearchingMessages(false);
      }
    }
  };

  const revealSearchResult = async (result: SearchHit) => {
    if (!selectedConv) return;

    if (!messages.some((message) => message.id === result.id)) {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("id", result.id)
        .maybeSingle();

      const belongsToConversation =
        data &&
        ((data.sender_id === currentUserId &&
          data.receiver_id === selectedConv.otherId) ||
          (data.sender_id === selectedConv.otherId &&
            data.receiver_id === currentUserId));

      if (error || !data || !belongsToConversation) {
        toast.error("Ce message n'est plus disponible.");
        return;
      }

      setMessages((previous) => {
        if (previous.some((message) => message.id === data.id)) return previous;
        return [...previous, data as Message].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      });
    }

    setHighlightedMessageId(result.id);
    window.setTimeout(() => {
      document.getElementById(`message-${result.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
    window.setTimeout(() => setHighlightedMessageId(null), 2200);
  };

  const exportConversation = async (format: "csv" | "pdf") => {
    if (!selectedConv) return;

    try {
      const response = await fetch("/api/messages/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          otherId: selectedConv.otherId,
          format,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      if (format === "csv") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `discussion-${selectedConv.otherNom}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }

      const html = await response.text();
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        window.setTimeout(() => printWindow.print(), 500);
      }
    } catch (error) {
      console.error("[ChatWindow] export error:", error);
      toast.error("L'export n'a pas pu être généré.");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prev) =>
        prev.filter((m) => {
          if (
            m.ephemeral &&
            m.expires_at &&
            new Date(m.expires_at) < new Date()
          )
            return false;
          return true;
        }),
      );
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Message copié.");
    } catch (error) {
      console.error("[ChatWindow] copyMessage error:", error);
      toast.error("Le message n'a pas pu être copié.");
    }
  };

  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setEditContent(msg.content);
  };

  const saveEdit = async () => {
    if (!editingMsg || !editContent.trim()) return;
    const { error } = await supabase
      .from("messages")
      .update({ content: editContent.trim() })
      .eq("id", editingMsg.id);
    if (error) {
      toast.error("La modification n'a pas pu être enregistrée.");
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingMsg.id ? { ...m, content: editContent.trim() } : m,
      ),
    );
    setEditingMsg(null);
    setEditContent("");
    toast.success("Message modifié.");
  };

  const startRecording = async () => {
    if (!selectedConv || !canContactRole(selectedConv.otherRole)) {
      toast.error("Vous pouvez uniquement contacter un administrateur.");
      return;
    }

    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("L'enregistrement vocal n'est pas pris en charge ici.");
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      const activeStream = stream;
      const selectedMimeType = preferredRecordingMimeType();
      const recorder = selectedMimeType
        ? new MediaRecorder(activeStream, { mimeType: selectedMimeType })
        : new MediaRecorder(activeStream);
      recordingMimeTypeRef.current =
        recorder.mimeType || selectedMimeType || "audio/webm";
      const chunks: Blob[] = [];
      cancelRecordingRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        console.log("[recorder.onstop] chunks:", chunks.length, "cancel:", cancelRecordingRef.current);
        setAudioChunks(chunks);
        activeStream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setMediaRecorder(null);
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          setAudioChunks([]);
          return;
        }
        if (chunks.length === 0) {
          toast.error("Aucun son n'a été capturé. Vérifiez votre microphone.");
          return;
        }
        window.setTimeout(() => {
          void sendAudio();
        }, 0);
      };
      recorder.start(250);
      setMediaRecorder(recorder);
      setRecording(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      toast.error("Microphone non autorisé.");
    }
  };

  const stopRecording = () => {
    console.log("[stopRecording] mediaRecorder:", mediaRecorder?.state);
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.requestData();
      } catch {
        // Certains navigateurs produisent déjà le dernier bloc lors de stop().
      }
      mediaRecorder.stop();
    }
    setRecording(false);
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setRecording(false);
    toast.success("Enregistrement annulé.");
  };

  const sendAudio = async () => {
    console.log("[sendAudio] appelé, chunks ref:", audioChunksRef.current.length, "selectedConv:", !!selectedConv);
    const chunks = audioChunksRef.current;
    if (
      chunks.length === 0 ||
      !selectedConv ||
      !canContactRole(selectedConv.otherRole)
    )
      return;
    setSending(true);
    const audioType =
      recordingMimeTypeRef.current || chunks[0]?.type || "audio/webm";
    const rawBlob = new Blob(chunks, { type: audioType });
    let storedPath: string | null = null;

    try {
      if (rawBlob.size === 0) {
        throw new Error("Enregistrement audio vide");
      }

      console.log("[sendAudio] rawBlob:", rawBlob.size, "bytes, type:", audioType);

      let uploadBlob: Blob;
      let uploadType: string;
      let uploadExt: string;
      try {
        uploadBlob = await convertBlobToMp3(rawBlob);
        uploadType = "audio/mpeg";
        uploadExt = "mp3";
        console.log("[sendAudio] MP3 converti:", uploadBlob.size, "bytes");
      } catch (convError) {
        console.warn("[sendAudio] Conversion MP3 échouée, fallback brut:", convError);
        uploadBlob = rawBlob;
        uploadType = audioType;
        uploadExt = audioFileExtension(audioType);
      }

      const fileName = `voice-${Date.now()}.${uploadExt}`;
      const filePath = `${currentUserId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(CHAT_FILES_BUCKET)
        .upload(filePath, uploadBlob, {
          cacheControl: "3600",
          contentType: uploadType,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      storedPath = filePath;
      console.log("[sendAudio] upload OK, path:", uploadData?.path);

      const { data: urlData } = supabase.storage
        .from(CHAT_FILES_BUCKET)
        .getPublicUrl(filePath);
      console.log("[sendAudio] public URL:", urlData.publicUrl);

      const data = await insertAttachmentMessage({
        receiverId: selectedConv.otherId,
        content: "🎤 Message vocal",
        fileUrl: urlData.publicUrl,
      });

      setMessages((previous) =>
        previous.some((message) => message.id === data.id)
          ? previous
          : [...previous, data],
      );
      setAudioChunks([]);
      storedPath = null;
      scrollToBottom();
      void fetchConversations();
    } catch (error) {
      console.error("[ChatWindow] sendAudio error:", error);
      if (storedPath) {
        void supabase.storage.from(CHAT_FILES_BUCKET).remove([storedPath]);
      }
      toast.error("Le message vocal n'a pas pu être envoyé.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        cancelRecordingRef.current = true;
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  const searchMentions = async (q: string) => {
    if (q.length < 1) {
      setShowMentions(false);
      return;
    }
    const { data } = await supabase
      .from("profils_publics")
      .select("id, nom, role")
      .ilike("nom", `%${q}%`)
      .limit(5);
    if (data && data.length > 0) {
      setMentionUsers(data);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: { nom: string }) => {
    const parts = newMessage.split("@");
    parts.pop();
    setNewMessage(parts.join("@") + `@${user.nom} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (
      selectedConv &&
      !selectedConv.closed &&
      canContactRole(selectedConv.otherRole)
    ) {
      setDragOver(true);
    }
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const renderTicks = (msg: Message) => {
    if (msg.sender_id !== currentUserId) return null;
    if (isOptimistic(msg.id)) {
      return (
        <span className="ml-1 inline-flex text-blue-100" title="Envoi en cours">
          <SpinnerIcon />
          <span className="sr-only">Envoi en cours</span>
        </span>
      );
    }
    if (msg.read_at) {
      return (
        <span className="text-blue-400 ml-1" title="Lu">
          <svg
            className="w-4 h-4 inline"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
      );
    }
    if (msg.read) {
      return (
        <span className="text-blue-400 ml-1" title="Envoyé">
          <svg
            className="w-4 h-4 inline"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>
      );
    }
    return (
      <span className="text-slate-300 ml-1" title="Envoyé">
        <svg
          className="w-4 h-4 inline"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </span>
    );
  };

  const visibleConversations = useMemo(() => {
    const query = conversationSearch.trim().toLocaleLowerCase("fr-FR");

    return conversations.filter((conv) => {
      if (!showClosed && conv.closed) return false;
      if (!query) return true;

      return [conv.otherNom, roleLabel(conv.otherRole), conv.lastMessage]
        .join(" ")
        .toLocaleLowerCase("fr-FR")
        .includes(query);
    });
  }, [conversationSearch, conversations, showClosed]);

  const unreadTotal = useMemo(
    () => conversations.reduce((total, conv) => total + conv.unread, 0),
    [conversations],
  );

  const typingText = Array.from(typingUsers.values()).join(", ");

  const filteredMessages = useMemo(() => {
    const query = msgSearch.trim().toLocaleLowerCase("fr-FR");
    if (!query) return messages;

    return messages.filter(
      (message) =>
        message.content.toLocaleLowerCase("fr-FR").includes(query),
    );
  }, [messages, msgSearch]);

  // Index par identifiant : permet de retrouver le message cité par une
  // réponse sans parcourir toute la liste à chaque bulle rendue.
  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  // Fait défiler jusqu'au message cité et le met brièvement en évidence.
  const jumpToMessage = useCallback((messageId: string) => {
    const target = document.getElementById(`message-${messageId}`);
    if (!target) return;
    setHighlightedMessageId(messageId);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightedMessageId(null), 2200);
  }, []);

  const retryLoad = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      await fetchConversations();
    } catch (error) {
      console.error("[ChatWindow] retryLoad error:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ChatWindowSkeleton />;
  }

  if (loadError) {
    return <ChatLoadError onRetry={() => void retryLoad()} />;
  }

  return (
    <div className="relative isolate flex h-full min-h-[560px] w-full overflow-hidden bg-white text-slate-900 md:rounded-[28px] md:border md:border-slate-200/80 md:shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
      <aside
        className={`${
          selectedConv ? "hidden md:flex" : "flex"
        } w-full shrink-0 flex-col border-r md:w-[350px] lg:w-[390px] border-slate-200/80 bg-slate-50/80`}
      >
        <div className="border-b border-slate-200/80 bg-white/80 px-4 pb-4 pt-4 backdrop-blur-xl sm:px-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-black tracking-tight text-slate-950">
                  Messagerie
                </h2>

                {unreadTotal > 0 && (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {unreadTotal > 0
                  ? `${unreadTotal} message${unreadTotal > 1 ? "s" : ""} non lu${unreadTotal > 1 ? "s" : ""}`
                  : `${conversations.length} discussion${conversations.length > 1 ? "s" : ""}`}
              </p>
            </div>

            <button
              type="button"
              onClick={toggleNewConversationPicker}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-expanded={showNewConv}
            >
              <PlusIcon />
              <span className="hidden lg:inline">Nouveau</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Rechercher une conversation</span>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Rechercher…"
                className="h-10 w-full rounded-xl border py-2 pl-10 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/30 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400"
              />
            </label>

            <button
              type="button"
              onClick={() => setShowClosed((previous) => !previous)}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${
                showClosed
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
              title={
                showClosed
                  ? "Masquer les conversations fermées"
                  : "Afficher les conversations fermées"
              }
              aria-label={
                showClosed
                  ? "Masquer les conversations fermées"
                  : "Afficher les conversations fermées"
              }
            >
              <ArchiveIcon />
            </button>
          </div>
        </div>

        {showNewConv && (
          <div className="border-b p-3 border-slate-200/80 bg-white">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700">
                {currentRole === "admin"
                  ? "Nouvelle conversation"
                  : "Choisir un administrateur"}
              </p>
              <button
                type="button"
                onClick={closeNewConversationPicker}
                className="grid h-7 w-7 place-items-center rounded-lg transition text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <CloseIcon />
              </button>
            </div>

            <p className="mb-3 text-[11px] leading-5 text-slate-500">
              {currentRole === "admin"
                ? "Recherchez une entreprise, un secrétaire ou un autre administrateur."
                : "Choisissez l’administrateur avec lequel vous souhaitez échanger."}
            </p>

            <label className="relative block">
              <span className="sr-only">
                {currentRole === "admin"
                  ? "Rechercher un utilisateur"
                  : "Rechercher un administrateur"}
              </span>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => void searchUsers(event.target.value)}
                placeholder={
                  currentRole === "admin"
                    ? "Rechercher un utilisateur…"
                    : "Rechercher un administrateur…"
                }
                autoFocus
                className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
              />
              {searchingUsers && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-blue-600">
                  <SpinnerIcon />
                </span>
              )}
            </label>

            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                {searchTerm.trim()
                  ? "Résultats"
                  : currentRole === "admin"
                    ? "Contacts disponibles"
                    : "Administrateurs disponibles"}
              </p>
              {!searchingUsers && searchResults.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                  {searchResults.length}
                </span>
              )}
            </div>

            {searchingUsers && searchResults.length === 0 ? (
              <div
                className="mt-2 space-y-1.5"
                aria-label="Chargement des contacts"
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex animate-pulse items-center gap-3 rounded-xl border border-slate-100 p-2.5"
                  >
                    <div className="h-9 w-9 rounded-full bg-slate-100" />
                    <div className="flex-1">
                      <div className="h-3 w-2/5 rounded bg-slate-100" />
                      <div className="mt-2 h-2.5 w-1/4 rounded bg-slate-50" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div
                className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1"
                aria-live="polite"
              >
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => startNewConversation(user)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition hover:border-blue-100 hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <ChatAvatar name={user.nom} role={user.role} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {user.nom}
                      </p>
                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        <span
                          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ring-1 ring-inset ${rolePillClass(user.role)}`}
                        >
                          {roleLabel(user.role)}
                        </span>
                        {user.email && (
                          <span className="min-w-0 truncate text-[10px] text-slate-400">
                            {user.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600">
                      <ChevronRightIcon />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
                <p className="text-xs font-bold text-slate-600">
                  {currentRole === "admin"
                    ? "Aucun contact trouvé"
                    : "Aucun administrateur trouvé"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {searchTerm.trim()
                    ? "Vérifiez l’orthographe du nom recherché."
                    : "Aucun profil correspondant n’est disponible pour le moment."}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {visibleConversations.length === 0 ? (
            <div className="flex h-full min-h-56 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                <MessageIcon />
              </div>
              <p className="text-sm font-bold text-slate-700">
                {conversationSearch
                  ? "Aucun résultat"
                  : showClosed
                    ? "Aucune conversation"
                    : "Aucune conversation active"}
              </p>
              <p className="mt-1 max-w-52 text-xs leading-5 text-slate-400">
                {conversationSearch
                  ? "Essayez avec un autre nom ou un autre mot-clé."
                  : "Démarrez une nouvelle discussion pour commencer à échanger."}
              </p>
              {!conversationSearch && (
                <button
                  type="button"
                  onClick={openNewConversationPicker}
                  className="mt-4 text-xs font-bold text-blue-600 transition hover:text-blue-700"
                >
                  + Nouvelle conversation
                </button>
              )}
            </div>
          ) : (
            visibleConversations.map((conv) => {
              const selected = selectedConv?.otherId === conv.otherId;
              const draft = selected
                ? newMessage.trim()
                : draftsRef.current.get(conv.otherId)?.trim();

              return (
                <button
                  key={conv.otherId}
                  type="button"
                  onClick={() => {
                    if (recording) {
                      toast.error(
                        "Terminez l'enregistrement vocal avant de changer de discussion.",
                      );
                      return;
                    }
                    if (selectedConv) {
                      draftsRef.current.set(selectedConv.otherId, newMessage);
                    }
                    setSelectedConv(conv);
                    setNewMessage(draftsRef.current.get(conv.otherId) ?? "");
                    messageSearchRequestRef.current += 1;
                    setSearchingMessages(false);
                    setShowProfile(false);
                    setShowMsgSearch(false);
                    setShowConversationMenu(false);
                    setActiveMessageActions(null);
                    setReplyingTo(null);
                    setEditingMsg(null);
                    setMsgSearch("");
                    setMsgSearchResults([]);
                  }}
                  className={`group relative mb-1 flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3 text-left transition ${
                    selected
                      ? "bg-white shadow-sm ring-1 ring-blue-100"
                      : "hover:bg-white/80"
                  }`}
                >
                  {selected && (
                    <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-blue-600" />
                  )}
                  <div className="relative shrink-0">
                    <ChatAvatar
                      name={conv.otherNom}
                      role={conv.otherRole}
                      size="md"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white text-[7px] font-black leading-none text-white ${roleDotClass(conv.otherRole)}`}
                      title={roleLabel(conv.otherRole)}
                      aria-label={roleLabel(conv.otherRole)}
                    >
                      {roleLabel(conv.otherRole).charAt(0)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`min-w-0 flex-1 truncate text-sm ${
                          conv.unread > 0 ? "font-black" : "font-bold"
                        } text-slate-900`}
                      >
                        {conv.otherNom}
                      </p>

                      {conv.lastDate && (
                        <span
                          className={`shrink-0 text-[10px] font-medium ${
                            conv.unread > 0 ? "text-blue-600" : "text-slate-400"
                          }`}
                        >
                          {formatConversationDate(conv.lastDate)}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <p
                        className={`min-w-0 flex-1 truncate text-xs ${
                          draft
                            ? "font-semibold text-amber-600"
                            : conv.unread > 0
                              ? "font-semibold text-slate-700"
                              : "text-slate-500"
                        }`}
                      >
                        {draft
                          ? `Brouillon : ${draft}`
                          : conv.lastMessage || "Nouvelle conversation"}
                      </p>

                      {conv.closed ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-500">
                          Fermée
                        </span>
                      ) : conv.unread > 0 ? (
                        <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                          {conv.unread > 99 ? "99+" : conv.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200/70 bg-white/60 px-4 py-3">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-blue-600 text-white">
                <MessageIcon />
              </span>
              Secrétariat Pro
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <ShieldIcon />
              Échanges sécurisés
            </span>
          </div>
        </div>
      </aside>

      <section
        className={`${
          selectedConv ? "flex" : "hidden md:flex"
        } min-w-0 flex-1 flex-col bg-white`}
      >
        {selectedConv ? (
          <>
            <header className="relative flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b px-3 py-3 sm:px-4 border-slate-200/80 bg-white/95 backdrop-blur">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (recording) {
                      toast.error(
                        "Terminez l'enregistrement vocal avant de quitter la discussion.",
                      );
                      return;
                    }
                    draftsRef.current.set(selectedConv.otherId, newMessage);
                    setSelectedConv(null);
                    setShowProfile(false);
                    setShowConversationMenu(false);
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border md:hidden border-slate-200 bg-white text-slate-600"
                  aria-label="Retour aux conversations"
                >
                  <BackIcon />
                </button>

                <div className="relative shrink-0">
                  <ChatAvatar
                    name={selectedConv.otherNom}
                    role={selectedConv.otherRole}
                    size="md"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white text-[7px] font-black leading-none text-white ${roleDotClass(selectedConv.otherRole)}`}
                    title={roleLabel(selectedConv.otherRole)}
                    aria-label={roleLabel(selectedConv.otherRole)}
                  >
                    {roleLabel(selectedConv.otherRole).charAt(0)}
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black sm:text-base text-slate-950">
                    {selectedConv.otherNom}
                  </h3>
                  <div
                    className="mt-0.5 flex items-center gap-1.5"
                    aria-live="polite"
                  >
                    <span
                      className={`text-[11px] font-medium ${
                        typingText ? "text-blue-600" : "text-slate-500"
                      }`}
                    >
                      {typingText
                        ? `${typingText} écrit…`
                        : roleLabel(selectedConv.otherRole)}
                    </span>
                    {!typingText && (
                      <>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="hidden text-[11px] sm:inline text-slate-400">
                          Canal sécurisé
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowMsgSearch((previous) => {
                      const next = !previous;
                      if (!next) {
                        setMsgSearch("");
                        setMsgSearchResults([]);
                        setSearchingMessages(false);
                        messageSearchRequestRef.current += 1;
                      }
                      return next;
                    });
                    setShowConversationMenu(false);
                  }}
                  className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                    showMsgSearch
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Rechercher dans la conversation"
                  aria-label="Rechercher dans la conversation"
                >
                  <SearchIcon />
                </button>

                {currentRole === "admin" && (
                  <button
                    type="button"
                    onClick={() => {
                      void loadProfile(selectedConv.otherId);
                      setShowConversationMenu(false);
                    }}
                    className="grid h-9 w-9 place-items-center rounded-xl transition text-slate-500 hover:bg-slate-100"
                    title="Voir le profil"
                    aria-label="Voir le profil"
                  >
                    <ProfileIcon />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setShowConversationMenu((previous) => !previous)
                  }
                  className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                    showConversationMenu
                      ? "bg-slate-100 text-slate-800"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                  aria-label="Actions de la conversation"
                  aria-expanded={showConversationMenu}
                >
                  <MoreIcon />
                </button>

                {showConversationMenu && (
                  <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl border p-1.5 shadow-xl border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => {
                        void exportConversation("csv");
                        setShowConversationMenu(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition text-slate-700 hover:bg-slate-50"
                    >
                      <DownloadIcon />
                      Exporter en CSV
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void exportConversation("pdf");
                        setShowConversationMenu(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition text-slate-700 hover:bg-slate-50"
                    >
                      <DocumentIcon />
                      Exporter / imprimer
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    {selectedConv.closed ? (
                      <button
                        type="button"
                        onClick={() => {
                          void reopenConversation(selectedConv.otherId);
                          setShowConversationMenu(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition text-emerald-700 hover:bg-emerald-50"
                      >
                        <UnlockIcon />
                        Rouvrir la discussion
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmAction({
                            kind: "closeConversation",
                            otherId: selectedConv.otherId,
                          });
                          setShowConversationMenu(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition text-rose-600 hover:bg-rose-50"
                      >
                        <ArchiveIcon />
                        Fermer la discussion
                      </button>
                    )}
                  </div>
                )}
              </div>
            </header>

            {showMsgSearch && (
              <div className="shrink-0 border-b px-3 py-3 sm:px-4 border-slate-200/80 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <label className="relative flex-1">
                    <span className="sr-only">
                      Rechercher dans la conversation
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <SearchIcon />
                    </span>
                    <input
                      type="search"
                      value={msgSearch}
                      onChange={(event) =>
                        void searchMessages(event.target.value)
                      }
                      placeholder="Rechercher un message…"
                      autoFocus
                      className="h-10 w-full rounded-xl border py-2 pl-10 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/30 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                    {searchingMessages && (
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-blue-600">
                        <SpinnerIcon />
                      </span>
                    )}
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMsgSearch(false);
                      setMsgSearch("");
                      setMsgSearchResults([]);
                      messageSearchRequestRef.current += 1;
                      setSearchingMessages(false);
                    }}
                    className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
                    aria-label="Fermer la recherche"
                  >
                    <CloseIcon />
                  </button>
                </div>

                {msgSearchResults.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {msgSearchResults.slice(0, 8).map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => void revealSearchResult(result)}
                        className="min-w-52 max-w-64 rounded-xl border px-3 py-2 text-left border-slate-200 bg-white hover:border-blue-200"
                      >
                        <p className="truncate text-xs font-bold">
                          {messagePreview({ content: result.content })}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {new Date(result.created_at).toLocaleString("fr-FR")}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {!searchingMessages &&
                  msgSearch.trim().length >= 2 &&
                  msgSearchResults.length === 0 && (
                    <p className="mt-2 px-1 text-[11px] font-medium text-slate-400">
                      Aucun message ne correspond à cette recherche.
                    </p>
                  )}
              </div>
            )}

            {selectedConv.closed && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 border-amber-100 bg-amber-50">
                <div className="flex min-w-0 items-center gap-2">
                  <ArchiveIcon />
                  <p className="truncate text-xs font-semibold text-amber-800">
                    Cette discussion est fermée. L&apos;envoi de nouveaux
                    messages est désactivé.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void reopenConversation(selectedConv.otherId)}
                  className="shrink-0 text-xs font-black text-emerald-700"
                >
                  Rouvrir
                </button>
              </div>
            )}

            <div
              ref={messagesContainerRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onTouchStart={swipeStart}
              onTouchMove={swipeMove}
              onTouchEnd={swipeEnd}
              aria-busy={loadingMessages}
              aria-live="polite"
              className={`relative min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5 lg:px-8 ${
                dragOver
                  ? "bg-blue-50 ring-2 ring-inset ring-blue-300"
                  : "bg-[radial-gradient(circle_at_top,_#f8fbff_0,_#ffffff_55%)]"
              }`}
              style={{
                transform:
                  swipeOffset > 0
                    ? `translateX(${Math.min(swipeOffset * 0.18, 18)}px)`
                    : swipeOffset < 0
                      ? `translateX(${Math.max(swipeOffset * 0.18, -18)}px)`
                      : undefined,
              }}
            >
              {dragOver && (
                <div className="pointer-events-none absolute inset-4 z-20 grid place-items-center rounded-3xl border-2 border-dashed border-blue-400 bg-blue-50/90 text-center backdrop-blur">
                  <div>
                    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white">
                      <PaperclipIcon />
                    </div>
                    <p className="text-sm font-black text-blue-700">
                      Déposez votre fichier ici
                    </p>
                    <p className="mt-1 text-xs text-blue-500">
                      Taille maximale : 10 Mo
                    </p>
                  </div>
                </div>
              )}

              {!loadingMessages && hasMoreMessages && (
                <div className="mb-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadOlder()}
                    disabled={loadingOlder}
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold shadow-sm transition disabled:opacity-60 border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  >
                    {loadingOlder ? <SpinnerIcon /> : <ChevronUpIcon />}
                    {loadingOlder
                      ? "Chargement…"
                      : "Afficher les messages précédents"}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <MessageListSkeleton />
              ) : filteredMessages.length === 0 ? (
                <div className="flex h-full min-h-72 flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                    {msgSearch ? <SearchIcon /> : <MessageIcon large />}
                  </div>
                  <p className="text-base font-black text-slate-800">
                    {msgSearch
                      ? "Aucun message trouvé"
                      : `Démarrez la conversation avec ${selectedConv.otherNom}`}
                  </p>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    {msgSearch
                      ? "Modifiez votre recherche pour afficher d'autres résultats."
                      : "Écrivez un premier message. Vos échanges apparaîtront ici en temps réel."}
                  </p>
                </div>
              ) : (
                filteredMessages.map((message, index) => {
                  const isMine = message.sender_id === currentUserId;
                  const isExpired =
                    message.ephemeral &&
                    message.expires_at &&
                    new Date(message.expires_at) < new Date();

                  if (isExpired) return null;

                  const previous = filteredMessages[index - 1];
                  const showDay =
                    !previous ||
                    !isSameDay(previous.created_at, message.created_at);

                  const attachment = resolveMessageAttachment(message);
                  const messageText = visibleMessageText(message, attachment);
                  const isDownloadingAttachment = Boolean(
                    attachment && downloadingAttachmentUrl === attachment.url,
                  );

                  return (
                    <div key={message.id}>
                      {showDay && (
                        <DaySeparator
                          label={formatDayLabel(message.created_at)}
                        />
                      )}

                      <div
                        id={`message-${message.id}`}
                        className={`group flex flex-col rounded-2xl transition ${
                          isMine ? "items-end" : "items-start"
                        } ${
                          highlightedMessageId === message.id
                            ? "bg-blue-50/80 ring-2 ring-blue-200 ring-offset-2"
                            : ""
                        }`}
                      >
                        <div
                          className={`relative max-w-[86%] rounded-[20px] px-3.5 py-2.5 text-sm leading-6 sm:max-w-[72%] lg:max-w-[66%] ${
                            isMine
                              ? "rounded-br-md bg-blue-600 text-white shadow-sm shadow-blue-600/10"
                              : "rounded-bl-md border border-slate-200/80 bg-white text-slate-800 shadow-[0_4px_16px_rgba(15,23,42,0.04)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMessageActions((current) =>
                                current === message.id ? null : message.id,
                              );
                            }}
                            className={`absolute top-1 h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm ${
                              isOptimistic(message.id) ? "hidden" : "grid sm:hidden"
                            } ${isMine ? "right-full mr-1" : "left-full ml-1"}`}
                            aria-label="Actions du message"
                            aria-expanded={activeMessageActions === message.id}
                          >
                            <MoreIcon />
                          </button>

                          {/* Citation du message auquel celui-ci répond.
                              Cliquable : ramène au message d'origine. */}
                          {(() => {
                            if (!message.reply_to) return null;
                            const quoted = messagesById.get(message.reply_to);
                            return (
                              <button
                                type="button"
                                onClick={() => quoted && jumpToMessage(quoted.id)}
                                disabled={!quoted}
                                className={`mb-1.5 flex w-full flex-col items-start gap-0.5 rounded-lg border-l-[3px] px-2 py-1 text-left transition ${
                                  isMine
                                    ? "border-white/60 bg-white/15 hover:bg-white/25 disabled:hover:bg-white/15"
                                    : "border-blue-400 bg-slate-50 hover:bg-slate-100 disabled:hover:bg-slate-50"
                                } ${quoted ? "cursor-pointer" : "cursor-default"}`}
                              >
                                <span
                                  className={`text-[10px] font-bold ${
                                    isMine ? "text-white/80" : "text-blue-600"
                                  }`}
                                >
                                  {quoted
                                    ? quoted.sender_id === currentUserId
                                      ? "Vous"
                                      : selectedConv.otherNom
                                    : "Message"}
                                </span>
                                <span
                                  className={`line-clamp-2 text-xs ${
                                    isMine ? "text-white/70" : "text-slate-500"
                                  }`}
                                >
                                  {quoted
                                    ? messagePreview(quoted)
                                    : "Message indisponible"}
                                </span>
                              </button>
                            );
                          })()}

                          {attachment && (
                            <div className={messageText ? "mb-2" : ""}>
                              {attachment.type.startsWith("image/") ? (
                                <div className="group relative overflow-hidden rounded-xl">
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name || "Image envoyée"}
                                      className="max-h-72 w-full object-cover transition group-hover:scale-[1.01]"
                                    />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void downloadAttachment(attachment)
                                    }
                                    disabled={downloadingAttachmentUrl !== null}
                                    className="absolute right-2 top-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950/75 px-2.5 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-slate-950 disabled:cursor-wait disabled:opacity-70"
                                    aria-label={`Télécharger ${attachment.name}`}
                                  >
                                    {isDownloadingAttachment ? (
                                      <SpinnerIcon />
                                    ) : (
                                      <DownloadIcon />
                                    )}
                                    <span className="hidden sm:inline">
                                      Enregistrer
                                    </span>
                                  </button>
                                </div>
                              ) : attachment.type.startsWith("audio/") ? (
                                <div
                                  className={`rounded-xl p-2.5 ${
                                    isMine
                                      ? "bg-white/95 text-slate-800"
                                      : "bg-slate-50 text-slate-800"
                                  }`}
                                >
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
                                        <MicIcon />
                                      </span>
                                      <span className="truncate text-xs font-bold">
                                        Message vocal
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void downloadAttachment(attachment)
                                      }
                                      disabled={
                                        downloadingAttachmentUrl !== null
                                      }
                                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
                                      aria-label="Télécharger le message vocal"
                                    >
                                      {isDownloadingAttachment ? (
                                        <SpinnerIcon />
                                      ) : (
                                        <DownloadIcon />
                                      )}
                                      Enregistrer
                                    </button>
                                  </div>
                                  <audio
                                    key={attachment.url}
                                    controls
                                    preload="metadata"
                                    className="h-10 w-[270px] max-w-full"
                                    onError={(e) => {
                                      const err = (e.target as HTMLAudioElement).error;
                                      console.error("[audio] Erreur lecture:", err?.code, err?.message, "URL:", attachment.url);
                                    }}
                                  >
                                    <source src={attachment.url} type={attachment.type} />
                                    Votre navigateur ne peut pas lire ce message
                                    vocal.
                                  </audio>
                                </div>
                              ) : (
                                <div
                                  className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                                    isMine
                                      ? "border-white/20 bg-white/10"
                                      : "border-slate-200 bg-slate-50"
                                  }`}
                                >
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                    aria-label={`Ouvrir ${attachment.name}`}
                                  >
                                    <span
                                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                                        isMine ? "bg-white/15" : "bg-white"
                                      }`}
                                    >
                                      <DocumentIcon />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-xs font-bold">
                                        {attachment.name || "Fichier"}
                                      </span>
                                      <span className="block text-[10px] opacity-70">
                                        Cliquer pour ouvrir
                                      </span>
                                    </span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void downloadAttachment(attachment)
                                    }
                                    disabled={downloadingAttachmentUrl !== null}
                                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-60 ${
                                      isMine
                                        ? "bg-white/15 text-white hover:bg-white/25"
                                        : "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 hover:bg-blue-50"
                                    }`}
                                    aria-label={`Télécharger ${attachment.name}`}
                                  >
                                    {isDownloadingAttachment ? (
                                      <SpinnerIcon />
                                    ) : (
                                      <DownloadIcon />
                                    )}
                                    <span className="hidden sm:inline">
                                      Enregistrer
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {editingMsg?.id === message.id ? (
                            <div className="min-w-[220px]">
                              <input
                                type="text"
                                value={editContent}
                                maxLength={MAX_MESSAGE_LENGTH}
                                onChange={(event) =>
                                  setEditContent(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") void saveEdit();
                                  if (event.key === "Escape") {
                                    setEditingMsg(null);
                                    setEditContent("");
                                  }
                                }}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none border-blue-300 bg-white text-slate-900"
                                autoFocus
                              />
                              <div className="mt-2 flex justify-end gap-2 text-[10px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMsg(null);
                                    setEditContent("");
                                  }}
                                  className="opacity-70 hover:opacity-100"
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void saveEdit()}
                                  disabled={!editContent.trim()}
                                  className={`${isMine ? "text-white" : "text-blue-600"} disabled:cursor-not-allowed disabled:opacity-40`}
                                >
                                  Enregistrer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {messageText && (
                                <p className="whitespace-pre-wrap break-words">
                                  {messageText}
                                </p>
                              )}

                              <div
                                className={`mt-1 flex items-center justify-end gap-1 text-[9px] font-medium ${
                                  isMine ? "text-blue-100" : "text-slate-400"
                                }`}
                              >
                                {message.ephemeral && (
                                  <span
                                    className="mr-0.5 inline-flex"
                                    title="Message éphémère"
                                  >
                                    <ClockIcon />
                                  </span>
                                )}
                                <span>
                                  {new Date(
                                    message.created_at,
                                  ).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {renderTicks(message)}
                              </div>
                            </>
                          )}

                          <div
                            className={`absolute ${
                              isMine ? "right-0" : "left-0"
                            } -top-10 z-10 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg ${
                              isOptimistic(message.id)
                                ? "hidden"
                                : activeMessageActions === message.id
                                  ? "flex"
                                  : "hidden sm:group-hover:flex sm:group-focus-within:flex"
                            }`}
                          >
                            <MessageAction
                              title="Copier"
                              onClick={() => {
                                void copyMessage(message.content);
                                setActiveMessageActions(null);
                              }}
                            >
                              <CopyIcon />
                            </MessageAction>

                            {isFeatureEnabled("replyToMessage") && (
                              <MessageAction
                                title="Répondre"
                                onClick={() => {
                                  setReplyingTo(message);
                                  setActiveMessageActions(null);
                                  inputRef.current?.focus();
                                }}
                              >
                                <ReplyIcon />
                              </MessageAction>
                            )}

                            {isFeatureEnabled("editableMessages") &&
                              isMine &&
                              !attachment && (
                                <MessageAction
                                  title="Modifier"
                                  onClick={() => {
                                    startEdit(message);
                                    setActiveMessageActions(null);
                                  }}
                                >
                                  <EditIcon />
                                </MessageAction>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {typingText && (
                <div className="mt-4 flex items-center gap-2 px-1">
                  <div className="flex items-center gap-1 rounded-2xl px-3 py-2 bg-slate-100">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">
                    {typingText} écrit…
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} className="h-1" />
            </div>

            {!selectedConv.closed && canContactRole(selectedConv.otherRole) ? (
              <div className="shrink-0 border-t px-3 py-3 sm:px-4 border-slate-200/80 bg-white">
                {ephemeralMode !== null && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold bg-purple-50 text-purple-700">
                    <ClockIcon />
                    Message éphémère ·{" "}
                    {
                      EPHEMERAL_OPTIONS.find(
                        (option) => option.ms === ephemeralMode,
                      )?.label
                    }
                    <button
                      type="button"
                      onClick={() => setEphemeralMode(null)}
                      className="ml-auto opacity-70 transition hover:opacity-100"
                      aria-label="Désactiver le mode éphémère"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                )}

                {replyingTo && (
                  <div className="mb-2 flex items-center gap-3 rounded-xl border-l-2 border-blue-500 px-3 py-2 bg-slate-50 text-slate-600">
                    <ReplyIcon />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-blue-600">
                        Réponse
                      </p>
                      <p className="truncate text-xs">
                        {messagePreview(replyingTo)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="opacity-60 hover:opacity-100"
                      aria-label="Annuler la réponse"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                )}

                {showMentions && mentionUsers.length > 0 && (
                  <div className="absolute bottom-[78px] left-4 z-30 w-72 overflow-hidden rounded-2xl border p-1.5 shadow-xl border-slate-200 bg-white">
                    {mentionUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => insertMention(user)}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-50"
                      >
                        <ChatAvatar
                          name={user.nom}
                          role={user.role}
                          size="xs"
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-bold">
                          {user.nom}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {roleLabel(user.role)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 rounded-2xl border p-2 transition focus-within:ring-2 focus-within:ring-blue-500/20 border-slate-200 bg-slate-50/70 focus-within:border-blue-400 focus-within:bg-white">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                  />

                  <ComposerTool
                    title={
                      uploadingFile ? "Envoi du fichier…" : "Joindre un fichier"
                    }
                    onClick={() => fileInputRef.current?.click()}
                    active={uploadingFile}
                    disabled={uploadingFile}
                  >
                    {uploadingFile ? <SpinnerIcon /> : <PaperclipIcon />}
                  </ComposerTool>

                  {isFeatureEnabled("voiceMessages") &&
                    (recording ? (
                      <>
                        <ComposerTool
                          title="Annuler l'enregistrement"
                          onClick={cancelRecording}
                          active={false}
                        >
                          <CloseIcon />
                        </ComposerTool>
                        <ComposerTool
                          title="Arrêter et envoyer"
                          onClick={stopRecording}
                          active
                          danger
                        >
                          <StopIcon />
                        </ComposerTool>
                      </>
                    ) : (
                      <ComposerTool
                        title="Message vocal"
                        onClick={() => void startRecording()}
                        active={false}
                      >
                        <MicIcon />
                      </ComposerTool>
                    ))}

                  <ComposerTool
                    title="Message éphémère"
                    onClick={() =>
                      setEphemeralMode((current) => {
                        if (current === null) return EPHEMERAL_OPTIONS[0].ms;
                        const index = EPHEMERAL_OPTIONS.findIndex(
                          (option) => option.ms === current,
                        );
                        return EPHEMERAL_OPTIONS[
                          (index + 1) % EPHEMERAL_OPTIONS.length
                        ].ms;
                      })
                    }
                    active={ephemeralMode !== null}
                  >
                    <ClockIcon />
                  </ComposerTool>

                  <div className="min-w-0 flex-1 px-1">
                    {recording ? (
                      <div
                        className="flex min-h-10 items-center gap-2 px-1 text-xs font-semibold text-rose-600"
                        role="status"
                      >
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
                        </span>
                        Enregistrement en cours…
                      </div>
                    ) : (
                      <textarea
                        ref={inputRef}
                        value={newMessage}
                        maxLength={MAX_MESSAGE_LENGTH}
                        onChange={(event) => {
                          const value = event.target.value;
                          setNewMessage(value);
                          handleTyping();

                          event.target.style.height = "0px";
                          event.target.style.height = `${Math.min(
                            event.target.scrollHeight,
                            120,
                          )}px`;

                          const atIndex = value.lastIndexOf("@");
                          const mentionPart =
                            atIndex >= 0 ? value.slice(atIndex + 1) : "";

                          if (
                            atIndex >= 0 &&
                            !mentionPart.includes(" ") &&
                            mentionPart.length <= 40
                          ) {
                            void searchMentions(mentionPart);
                          } else {
                            setShowMentions(false);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey &&
                            !showMentions &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            void sendMessage();
                          }
                        }}
                        placeholder={
                          replyingTo
                            ? "Écrire votre réponse…"
                            : "Écrire un message…"
                        }
                        rows={1}
                        className="max-h-[120px] min-h-[40px] w-full resize-none bg-transparent py-2 text-sm leading-6 outline-none text-slate-900 placeholder:text-slate-400"
                        aria-label="Message"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={!newMessage.trim() || sending || recording}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Envoyer"
                  >
                    {sending ? <SpinnerIcon /> : <SendIcon />}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-400">
                  <span className="hidden sm:inline">
                    Entrée pour envoyer · Maj + Entrée pour aller à la ligne
                  </span>
                  <span className="ml-auto">
                    {newMessage.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
              </div>
            ) : selectedConv.closed ? (
              <div className="shrink-0 border-t p-4 text-center border-slate-200/80 bg-slate-50">
                <p className="text-xs font-medium text-slate-500">
                  Discussion fermée — rouvrez-la pour envoyer un nouveau
                  message.
                </p>
              </div>
            ) : (
              <div className="shrink-0 border-t border-amber-100 bg-amber-50 p-4 text-center">
                <p className="text-xs font-semibold text-amber-800">
                  Votre profil peut uniquement démarrer une discussion avec un
                  administrateur.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 bg-[radial-gradient(circle_at_center,_#f8fbff,_#ffffff_65%)]">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[28px] bg-white text-blue-600 shadow-[0_16px_40px_rgba(37,99,235,0.10)] ring-1 ring-blue-100">
                <MessageIcon large />
              </div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">
                Votre centre de messages
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sélectionnez une conversation dans la colonne de gauche ou
                démarrez-en une nouvelle.
              </p>
            </div>
          </div>
        )}
      </section>

      {showProfile && activeProfile && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-30 bg-slate-950/20 backdrop-blur-[1px]"
            onClick={() => setShowProfile(false)}
            aria-label="Fermer le profil"
          />
          <aside
            className="absolute inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l shadow-2xl sm:w-[360px] border-slate-200 bg-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-profile-title"
          >
            <div className="flex items-center justify-between border-b px-5 py-4 border-slate-200">
              <div>
                <p id="contact-profile-title" className="text-sm font-black">
                  Informations du contact
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {profileLoading
                    ? "Chargement des coordonnées…"
                    : "Coordonnées du contact"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProfile(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Fermer"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-col items-center text-center">
                <ChatAvatar
                  name={activeProfile.nom}
                  role={activeProfile.role}
                  size="xl"
                />
                <h4 className="mt-4 text-lg font-black text-slate-950">
                  {activeProfile.nom}
                </h4>
                <span className="mt-2 rounded-full px-3 py-1 text-[10px] font-bold bg-blue-50 text-blue-700">
                  {roleLabel(activeProfile.role)}
                </span>
              </div>

              <div className="mt-8 space-y-3">
                {profileLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[66px] animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
                    />
                  ))
                ) : (
                  <>
                    {/* Les coordonnées ne sont plus partagées entre
                        utilisateurs (migration 007) : les échanges passent
                        par la messagerie. */}
                    <ProfileField
                      label="Rôle"
                      value={roleLabel(activeProfile.role)}
                    />
                    <ProfileField
                      label="Coordonnées"
                      value="Échanges via la messagerie"
                    />
                  </>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {confirmAction && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={() => {
              if (!confirmingAction) setConfirmAction(null);
            }}
            aria-label="Annuler"
          />
          <div
            className="absolute left-1/2 top-1/2 z-[60] w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-action-title"
            aria-describedby="confirm-action-description"
          >
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangleIcon />
            </div>
            <h3
              id="confirm-action-title"
              className="mt-4 text-base font-black text-slate-950"
            >
              Fermer cette discussion ?
            </h3>
            <p
              id="confirm-action-description"
              className="mt-2 text-sm leading-6 text-slate-500"
            >
              Il ne sera plus possible d&apos;envoyer de nouveaux messages tant que
              la discussion ne sera pas rouverte.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={confirmingAction}
                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmPendingAction()}
                disabled={confirmingAction}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
              >
                {confirmingAction && <SpinnerIcon />}
                Fermer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChatLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-[560px] w-full items-center justify-center rounded-[28px] border border-slate-200 bg-white px-6 text-center shadow-sm">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangleIcon />
        </div>
        <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">
          La messagerie est indisponible
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Vérifiez votre connexion, puis réessayez. Aucun message n&apos;a été
          perdu.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <RefreshIcon />
          Réessayer
        </button>
      </div>
    </div>
  );
}

function MessageListSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 py-3"
      aria-label="Chargement des messages"
    >
      {[42, 64, 48, 72, 38].map((width, index) => (
        <div
          key={`${width}-${index}`}
          className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className="h-14 animate-pulse rounded-[20px] bg-slate-100"
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function ChatWindowSkeleton() {
  return (
    <div className="flex h-full min-h-[560px] w-full overflow-hidden bg-white md:rounded-[28px] md:border md:border-slate-200/80 md:shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="w-full shrink-0 border-r border-slate-200 bg-slate-50/60 p-4 md:w-[360px]">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div className="mt-4 h-10 animate-pulse rounded-xl bg-slate-200/80" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl bg-white/70 p-3"
            >
              <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-2/5 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden flex-1 items-center justify-center p-6 md:flex">
        <SkeletonChat />
      </div>
    </div>
  );
}

function ChatAvatar({
  name,
  role,
  src,
  size = "md",
}: {
  name: string;
  role: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "xl";
}) {
  const sizes = {
    xs: "h-8 w-8 text-[11px]",
    sm: "h-10 w-10 text-xs",
    md: "h-11 w-11 text-sm",
    xl: "h-20 w-20 text-xl",
  };

  const palette =
    role === "admin"
      ? "bg-gradient-to-br from-amber-100 to-orange-100 text-amber-800"
      : role === "entreprise"
        ? "bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800"
        : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-800";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover ring-1 ring-black/5`}
      />
    );
  }

  return (
    <span
      className={`${sizes[size]} ${palette} grid shrink-0 select-none place-items-center rounded-full font-black uppercase tracking-tight ring-1 ring-black/5`}
      aria-label={name}
    >
      {getInitials(name)}
    </span>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-100" />
      <span className="rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-[0.08em] border-slate-200 bg-white text-slate-400">
        {label}
      </span>
      <span className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-3.5 border-slate-200 bg-slate-50/70">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function MessageAction({
  title,
  onClick,
  danger = false,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-lg transition ${
        danger
          ? "text-rose-500 hover:bg-rose-50"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function ComposerTool({
  title,
  onClick,
  active,
  danger = false,
  disabled = false,
  children,
}: {
  title: string;
  onClick: () => void;
  active: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition disabled:cursor-wait disabled:opacity-60 ${
        danger
          ? "bg-rose-50 text-rose-600"
          : active
            ? "bg-purple-50 text-purple-700"
            : "text-slate-500 hover:bg-white hover:text-slate-700"
      }`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

type IconProps = { large?: boolean };

function Icon({
  children,
  large = false,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={large ? "h-8 w-8" : "h-4 w-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </Icon>
  );
}

function PlusIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </Icon>
  );
}

function MessageIcon({ large = false }: IconProps) {
  return (
    <Icon large={large}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.4-4A8 8 0 1 1 21 12Z"
      />
      <path strokeLinecap="round" d="M8 10h8M8 14h5" />
    </Icon>
  );
}

function ArchiveIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M6 7v12h12V7M9 11h6"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 4h14l1 3H4l1-3Z"
      />
    </Icon>
  );
}

function ShieldIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 19 6v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6l7-3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </Icon>
  );
}

function AlertTriangleIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4 21 20H3L12 4Z"
      />
      <path strokeLinecap="round" d="M12 9v5M12 17.5h.01" />
    </Icon>
  );
}

function RefreshIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7v5h-5M4 17v-5h5"
      />
      <path
        strokeLinecap="round"
        d="M18.2 10A7 7 0 0 0 6.1 7.4L4 10M5.8 14A7 7 0 0 0 17.9 16.6L20 14"
      />
    </Icon>
  );
}

function ProfileIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3" />
      <path strokeLinecap="round" d="M5.5 19c.8-3.4 3-5 6.5-5s5.7 1.6 6.5 5" />
    </Icon>
  );
}

function MoreIcon() {
  return (
    <Icon>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

function DownloadIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
    </Icon>
  );
}

function DocumentIcon() {
  return (
    <Icon>
      <path strokeLinejoin="round" d="M7 3h7l4 4v14H7zM14 3v5h4" />
      <path strokeLinecap="round" d="M10 13h5M10 17h5" />
    </Icon>
  );
}

function UnlockIcon() {
  return (
    <Icon>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path strokeLinecap="round" d="M9 10V7a3 3 0 0 1 5.4-1.8" />
    </Icon>
  );
}

function BackIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
    </Icon>
  );
}

function ChevronRightIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </Icon>
  );
}

function ChevronUpIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 15 6-6 6 6" />
    </Icon>
  );
}

function CloseIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

function PaperclipIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m15.5 7-6.7 6.7a2.5 2.5 0 0 0 3.5 3.6l6.3-6.4a4.5 4.5 0 0 0-6.4-6.3L5.8 11a6.5 6.5 0 0 0 9.2 9.2l5.5-5.5"
      />
    </Icon>
  );
}

function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </Icon>
  );
}

function MicIcon() {
  return (
    <Icon>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </Icon>
  );
}

function StopIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4 21 12 4 20l3-8-3-8Zm3 8h7"
      />
    </Icon>
  );
}

function SpinnerIcon() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}


function CopyIcon() {
  return (
    <Icon>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icon>
  );
}

function ReplyIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m10 8-5 4 5 4v-3h4c3 0 5 1.5 6 4-.2-5.5-2.7-8-7-8h-3V8Z"
      />
    </Icon>
  );
}


function EditIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4 20 4.5-1 9.8-9.8-3.5-3.5L5 15.5 4 20ZM13.8 6.7l3.5 3.5"
      />
    </Icon>
  );
}

