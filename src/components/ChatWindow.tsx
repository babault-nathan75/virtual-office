'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/Toast';
import { SkeletonChat } from '@/components/Skeleton';
import { isFeatureEnabled } from '@/lib/features';
import { useSwipeActions } from '@/hooks/useSwipeActions';

type Message = {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  read_at: string | null;
  closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
  deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  ephemeral: boolean;
  expires_at: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  pinned: boolean;
  pinned_by: string | null;
  pinned_at: string | null;
  reply_to: number | null;
  reactions: Record<string, string[]> | null;
  created_at: string;
};

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
  avatar_url?: string;
  last_seen?: string;
};

type SearchHit = { id: number; sender_id: string; content: string; created_at: string };

type Props = {
  currentUserId: string;
  currentRole: 'entreprise' | 'secretaire' | 'admin';
  adminId?: string;
};

const PAGE_SIZE = 30;
const EPHEMERAL_OPTIONS = [
  { label: '5 min', ms: 5 * 60 * 1000 },
  { label: '1 h', ms: 60 * 60 * 1000 },
  { label: '24 h', ms: 24 * 60 * 60 * 1000 },
];

export default function ChatWindow({ currentUserId, currentRole, adminId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; nom: string; role: string }[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [isTyping, setIsTyping] = useState(false);
  const [msgSearch, setMsgSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<{ id: string; nom: string; role: string }[]>([]);
  const [msgSearchResults, setMsgSearchResults] = useState<SearchHit[]>([]);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [olderCount, setOlderCount] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [ephemeralMode, setEphemeralMode] = useState<number | null>(null);
  const [dark, setDark] = useState(false);
  const [showEmoji, setShowEmoji] = useState<number | false>(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunksState] = useState<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const setAudioChunks = (chunks: Blob[]) => { audioChunksRef.current = chunks; setAudioChunksState(chunks); };
  const [currentUserName, setCurrentUserName] = useState('Utilisateur');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { offset: swipeOffset, onTouchStart: swipeStart, onTouchMove: swipeMove, onTouchEnd: swipeEnd } = useSwipeActions({
    onSwipeLeft: () => { if (selectedConv) closeConversation(selectedConv.otherId); },
    onSwipeRight: () => { if (selectedConv) reopenConversation(selectedConv.otherId); },
  });

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from('profils').select('nom').eq('id', currentUserId).maybeSingle()
      .then(({ data }) => { if (data?.nom) setCurrentUserName(data.nom); });
  }, [currentUserId]);

  const getStatusInfo = (lastSeen?: string) => {
    if (!lastSeen) return { text: 'Hors ligne', online: false, color: 'bg-slate-300 dark:bg-slate-600' };
    const diffMinutes = Math.floor((new Date().getTime() - new Date(lastSeen).getTime()) / 60000);
    if (diffMinutes < 3) return { text: 'En ligne', online: true, color: 'bg-emerald-500 animate-pulse' };
    if (diffMinutes < 60) return { text: `Actif il y a ${diffMinutes} min`, online: false, color: 'bg-amber-400' };
    if (diffMinutes < 1440) return { text: `Actif il y a ${Math.floor(diffMinutes / 60)}h`, online: false, color: 'bg-slate-300' };
    return { text: 'Hors ligne', online: false, color: 'bg-slate-300' };
  };

  const fetchConversations = useCallback(async () => {
    const { data: allMessages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, read, closed, closed_by, deleted, created_at')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ChatWindow] fetchConversations error:', error);
      return;
    }

    if (!allMessages) return;

    const convMap = new Map<string, { lastMessage: string; lastDate: string; unread: number; closed: boolean; closedBy: string | null }>();
    for (const m of allMessages) {
      if (m.deleted) continue;
      const otherId = m.sender_id === currentUserId ? m.receiver_id : m.sender_id;
      const existing = convMap.get(otherId);
      const unread = m.receiver_id === currentUserId && !m.read ? 1 : 0;
      if (!existing || new Date(m.created_at) > new Date(existing.lastDate)) {
        convMap.set(otherId, {
          lastMessage: m.content,
          lastDate: m.created_at,
          unread: existing ? existing.unread + unread : unread,
          closed: m.closed,
          closedBy: m.closed_by,
        });
      } else if (unread > 0 && existing) {
        convMap.set(otherId, { ...existing, unread: existing.unread + unread });
      }
    }

    const otherIds = Array.from(convMap.keys());
    if (otherIds.length === 0) {
      setConversations([]);
      setSelectedConv(null);
      return;
    }

    const { data: profils } = await supabase.from('profils').select('id, nom, role').in('id', otherIds);
    const profilMap = new Map((profils ?? []).map(p => [p.id, { nom: p.nom, role: p.role }]));

    const convs: Conversation[] = otherIds.map(id => ({
      otherId: id,
      otherNom: profilMap.get(id)?.nom ?? 'Utilisateur',
      otherRole: profilMap.get(id)?.role ?? 'secretaire',
      ...convMap.get(id)!,
    })).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());

    setConversations(convs);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;

    const loadConversations = async () => {
      setLoading(true);
      try {
        await fetchConversations();
      } catch (err) {
        console.error('[ChatWindow] loadConversations error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadConversations();
    return () => { cancelled = true; };
  }, [currentUserId, fetchConversations]);

  // Realtime conv list
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`conv-list:${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Message;
        if (m.sender_id === currentUserId || m.receiver_id === currentUserId) fetchConversations();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Message;
        if (m.sender_id === currentUserId || m.receiver_id === currentUserId) fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, fetchConversations]);

  // Open conversation
  useEffect(() => {
    if (!currentUserId || !selectedConv) return;

    const openConversation = async () => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedConv.otherId}),and(sender_id.eq.${selectedConv.otherId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE);

      if (msgs) {
        setMessages(msgs);
        setOlderCount(0);
        setTimeout(() => scrollToBottom(false), 50);
      }

      await supabase
        .from('messages')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('receiver_id', currentUserId)
        .eq('sender_id', selectedConv.otherId)
        .eq('read', false);

      setConversations(prev => prev.map(c =>
        c.otherId === selectedConv.otherId ? { ...c, unread: 0 } : c
      ));
    };

    openConversation();

    // Typing channel
    const typingChannel = supabase
      .channel(`typing:${selectedConv.otherId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const data = payload.payload as { userId: string; name: string; typing: boolean };
        if (data.userId !== currentUserId) {
          setTypingUsers(prev => {
            const next = new Map(prev);
            if (data.typing) next.set(data.userId, data.name);
            else next.delete(data.userId);
            return next;
          });
        }
      })
      .subscribe();

    // Messages realtime
    const msgChannel = supabase
      .channel(`chat:${currentUserId}-${selectedConv.otherId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as Message;
        if (
          (newMsg.sender_id === currentUserId && newMsg.receiver_id === selectedConv.otherId) ||
          (newMsg.sender_id === selectedConv.otherId && newMsg.receiver_id === currentUserId)
        ) {
          setMessages(prev => [...prev, newMsg]);
          setTimeout(scrollToBottom, 100);

          if (newMsg.sender_id !== currentUserId) {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('SecrétariatPro', {
                body: newMsg.content.slice(0, 100),
                icon: '/icon-192.png',
              });
            }
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(typingChannel);
      setTypingUsers(new Map());
    };
  }, [currentUserId, selectedConv, scrollToBottom]);

  // Load older messages
  const loadOlder = async () => {
    if (!selectedConv || messages.length === 0) return;
    setLoadingOlder(true);
    const oldest = messages[0];
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedConv.otherId}),and(sender_id.eq.${selectedConv.otherId},receiver_id.eq.${currentUserId})`)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (data && data.length > 0) {
      setMessages(prev => [...data.reverse(), ...prev]);
      setOlderCount(prev => prev + data.length);
    }
    setLoadingOlder(false);
  };

  // Typing indicator
  const handleTyping = () => {
    if (!selectedConv) return;
    if (!isTyping) {
      setIsTyping(true);
      supabase.channel(`typing:${currentUserId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, name: currentUserName, typing: true },
      });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      supabase.channel(`typing:${currentUserId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, name: currentUserName, typing: false },
      });
    }, 3000);
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    setSending(true);
    const contentToSend = newMessage.trim();
    const replyToId = replyingTo?.id || null;
    setNewMessage('');
    setEphemeralMode(null);
    setReplyingTo(null);

    // Optimistic update
    const optimisticMsg: Message = {
      id: Date.now(),
      sender_id: currentUserId,
      receiver_id: selectedConv.otherId,
      content: contentToSend,
      read: false,
      read_at: null,
      closed: false,
      closed_by: null,
      closed_at: null,
      deleted: false,
      deleted_by: null,
      deleted_at: null,
      ephemeral: ephemeralMode !== null,
      expires_at: ephemeralMode ? new Date(Date.now() + ephemeralMode).toISOString() : null,
      file_url: null,
      file_type: null,
      file_name: null,
      pinned: false,
      pinned_by: null,
      pinned_at: null,
      reply_to: replyToId,
      reactions: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    const insertData: Record<string, unknown> = {
      sender_id: currentUserId,
      receiver_id: selectedConv.otherId,
      content: contentToSend,
      read: false,
      reply_to: replyToId,
    };

    if (ephemeralMode !== null) {
      insertData.ephemeral = true;
      insertData.expires_at = new Date(Date.now() + ephemeralMode).toISOString();
    }

    const { error } = await supabase.from('messages').insert(insertData);

    if (error) {
      toast.error('Erreur : ' + error.message);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setNewMessage(contentToSend);
    } else {
      setTypingUsers(prev => {
        const next = new Map(prev);
        next.delete(currentUserId);
        return next;
      });
    }
    setSending(false);
    inputRef.current?.focus();
  };

  // Upload file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConv) return;

    const ext = file.name.split('.').pop();
    const path = `${currentUserId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('chat-files')
      .upload(path, file, { contentType: file.type });

    if (error) {
      toast.error('Erreur upload : ' + error.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path);

    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: selectedConv.otherId,
      content: file.name,
      read: false,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_name: file.name,
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Soft delete
  const deleteMessage = async (msgId: number) => {
    const { error } = await supabase
      .from('messages')
      .update({ deleted: true, deleted_by: currentUserId, deleted_at: new Date().toISOString() })
      .eq('id', msgId);

    if (error) {
      toast.error('Erreur lors de la suppression.');
    } else {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, deleted_by: currentUserId } : m));
    }
  };

  // Search users
  const searchUsers = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from('profils').select('id, nom, role').neq('id', currentUserId).ilike('nom', `%${term}%`).limit(8);
    setSearchResults((data ?? []).map(p => ({ id: p.id, nom: p.nom, role: p.role })));
  };

  const startNewConversation = (user: { id: string; nom: string; role: string }) => {
    const conv: Conversation = { otherId: user.id, otherNom: user.nom, otherRole: user.role, lastMessage: '', lastDate: '', unread: 0, closed: false, closedBy: null };
    setConversations(prev => { if (prev.some(c => c.otherId === user.id)) return prev; return [conv, ...prev]; });
    setSelectedConv(conv);
    setShowNewConv(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Close / reopen
  const closeConversation = async (otherId: string) => {
    const { error } = await supabase.from('messages').update({ closed: true, closed_by: currentUserId, closed_at: new Date().toISOString() })
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUserId})`).eq('closed', false);
    if (error) { toast.error('Erreur.'); return; }
    setConversations(prev => prev.map(c => c.otherId === otherId ? { ...c, closed: true, closedBy: currentUserId } : c));
    if (selectedConv?.otherId === otherId) setSelectedConv(prev => prev ? { ...prev, closed: true, closedBy: currentUserId } : null);
    toast.success('Discussion fermée.');
  };

  const reopenConversation = async (otherId: string) => {
    const { error } = await supabase.from('messages').update({ closed: false, closed_by: null, closed_at: null })
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUserId})`).eq('closed', true);
    if (error) { toast.error('Erreur.'); return; }
    setConversations(prev => prev.map(c => c.otherId === otherId ? { ...c, closed: false, closedBy: null } : c));
    if (selectedConv?.otherId === otherId) setSelectedConv(prev => prev ? { ...prev, closed: false, closedBy: null } : null);
    toast.success('Discussion rouverte.');
  };

  // Profile drawer
  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profils').select('id, nom, role, email, telephone, avatar_url, last_seen').eq('id', userId).maybeSingle();
    if (data) { setActiveProfile(data as Profile); setShowProfile(true); }
  };

  // Message search
  const searchMessages = async (q: string) => {
    setMsgSearch(q);
    if (q.length < 2 || !selectedConv) { setMsgSearchResults([]); return; }
    const res = await fetch(`/api/messages/search?userId=${currentUserId}&otherId=${selectedConv.otherId}&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setMsgSearchResults(data.results || []);
  };

  // Export
  const exportConversation = async (format: 'csv' | 'pdf') => {
    if (!selectedConv) return;
    const res = await fetch('/api/messages/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, otherId: selectedConv.otherId, format }),
    });
    if (format === 'csv') {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `discussion-${selectedConv.otherNom}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const html = await res.text();
      const win = window.open('', '_blank');
      if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
    }
  };

  // Delete expired ephemeral messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => prev.filter(m => {
        if (m.ephemeral && m.expires_at && new Date(m.expires_at) < new Date()) return false;
        return true;
      }));
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Copy message
  const copyMessage = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toast.success('Message copié !');
  };

  // Emoji picker
  const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👋', '🎉', '🔥', '💯', '✅', '❌', '⏰', '💬', '📎'];

  const addReaction = async (msgId: number, emoji: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const reactions = msg.reactions ? { ...msg.reactions } : {};
    const users = reactions[emoji] || [];
    if (users.includes(currentUserId)) {
      reactions[emoji] = users.filter(u => u !== currentUserId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, currentUserId];
    }
    await supabase.from('messages').update({ reactions }).eq('id', msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    setShowEmoji(false);
  };

  // Edit message
  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setEditContent(msg.content);
  };

  const saveEdit = async () => {
    if (!editingMsg || !editContent.trim()) return;
    await supabase.from('messages').update({ content: editContent.trim() }).eq('id', editingMsg.id);
    setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: editContent.trim() } : m));
    setEditingMsg(null);
    setEditContent('');
    toast.success('Message modifié.');
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        setAudioChunks(chunks);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch {
      toast.error('Microphone non autorisé.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setRecording(false);
  };

  const sendAudio = async () => {
    const chunks = audioChunksRef.current;
    if (chunks.length === 0 || !selectedConv) return;
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const ext = 'webm';
    const fileName = `voice-${Date.now()}.${ext}`;
    const filePath = `chat-audio/${currentUserId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('chat-audio').upload(filePath, blob);
    if (uploadError) { toast.error('Erreur envoi vocal.'); return; }

    const { data: urlData } = supabase.storage.from('chat-audio').getPublicUrl(filePath);

    const replyToId = replyingTo?.id || null;
    const { data, error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: selectedConv.otherId,
      content: '🎤 Message vocal',
      file_url: urlData.publicUrl,
      file_type: 'audio/webm',
      file_name: fileName,
      ephemeral: ephemeralMode !== null,
      expires_at: ephemeralMode ? new Date(Date.now() + ephemeralMode).toISOString() : null,
      reply_to: replyToId,
    }).select().single();

    if (!error && data) {
      setMessages(prev => [...prev, data]);
      setAudioChunks([]);
      setReplyingTo(null);
      scrollToBottom();
      fetchConversations();
    }
  };

  // Pin message
  const pinMessage = async (msgId: number) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const newPinned = !msg.pinned;
    await supabase.from('messages').update({ pinned: newPinned, pinned_by: newPinned ? currentUserId : null, pinned_at: newPinned ? new Date().toISOString() : null }).eq('id', msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pinned: newPinned, pinned_by: newPinned ? currentUserId : null } : m));
    toast.success(newPinned ? 'Message épinglé.' : 'Désépinglé.');
  };

  // Mentions search
  const searchMentions = async (q: string) => {
    setMentionQuery(q);
    if (q.length < 1) { setShowMentions(false); return; }
    const { data } = await supabase.from('profils').select('id, nom, role').ilike('nom', `%${q}%`).limit(5);
    if (data && data.length > 0) {
      setMentionUsers(data);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: { nom: string }) => {
    const parts = newMessage.split('@');
    parts.pop();
    setNewMessage(parts.join('@') + `@${user.nom} `);
    setShowMentions(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !selectedConv) return;
    const ext = file.name.split('.').pop();
    const path = `${currentUserId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type });
    if (error) { toast.error('Erreur upload : ' + error.message); return; }
    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path);
    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: selectedConv.otherId,
      content: file.name,
      read: false,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_name: file.name,
      reply_to: replyingTo?.id || null,
    });
    setReplyingTo(null);
    fetchConversations();
    toast.success('Fichier envoyé !');
  };

  // Render ticks
  const renderTicks = (msg: Message) => {
    if (msg.sender_id !== currentUserId) return null;
    if (msg.read_at) {
      return <span className="text-blue-400 ml-1" title="Lu"><svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>;
    }
    if (msg.read) {
      return <span className="text-blue-400 ml-1" title="Envoyé"><svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>;
    }
    return <span className="text-slate-300 ml-1" title="Envoyé"><svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>;
  };

  if (loading) return (
    <div className={`flex h-[75vh] rounded-2xl border overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.04)] ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
      <div className={`w-80 border-r ${dark ? 'border-gray-700 bg-gray-900/30' : 'border-slate-100 bg-slate-50/30'}`}>
        <div className={`p-4 border-b ${dark ? 'border-gray-700' : 'border-slate-100'}`}>
          <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded animate-pulse w-24" />
        </div>
        <div className="p-3 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-gray-700 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
                <div className="h-2 bg-slate-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <SkeletonChat />
      </div>
    </div>
  );

  const visibleConversations = showClosed ? conversations : conversations.filter(c => !c.closed);
  const typingText = Array.from(typingUsers.values()).join(', ');
  const filteredMessages = msgSearch ? messages.filter(m => !m.deleted && m.content.toLowerCase().includes(msgSearch.toLowerCase())) : messages;

  return (
    <div className={`flex h-[75vh] rounded-2xl border overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.04)] ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
      {/* Sidebar */}
      <div className={`w-80 border-r flex flex-col ${dark ? 'border-gray-700 bg-gray-900/30' : 'border-slate-100 bg-slate-50/30'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${dark ? 'border-gray-700' : 'border-slate-100'}`}>
          <h2 className={`font-black tracking-tight text-sm ${dark ? 'text-white' : 'text-slate-900'}`}>
            {currentRole === 'admin' ? 'Conversations' : 'Discussions'}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMsgSearch(!showMsgSearch)} className={`text-[10px] font-bold px-2 py-1 rounded-md transition ${showMsgSearch ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : dark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title="Rechercher dans les messages">🔍</button>
            <button onClick={() => setShowClosed(!showClosed)} className={`text-[10px] font-bold px-2 py-1 rounded-md transition ${showClosed ? (dark ? 'bg-gray-600 text-gray-200' : 'bg-slate-200 text-slate-700') : dark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title={showClosed ? 'Masquer les fermées' : 'Afficher les fermées'}>
              {showClosed ? '📋' : '🗄️'}
            </button>
            <button onClick={() => setShowNewConv(!showNewConv)} className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition shadow-sm">+ Nouvelle</button>
          </div>
        </div>

        {/* Message search panel */}
        {showMsgSearch && (
          <div className={`p-3 border-b ${dark ? 'border-gray-700 bg-gray-800' : 'border-slate-100 bg-white'}`}>
            <input type="text" value={msgSearch} onChange={e => searchMessages(e.target.value)} placeholder="Rechercher dans les messages..." autoFocus
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${dark ? 'bg-gray-700 border-gray-600 text-white' : 'border-slate-200'}`} />
            {msgSearchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {msgSearchResults.map(r => (
                  <button key={r.id} className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${dark ? 'hover:bg-gray-700' : 'hover:bg-blue-50'}`}>
                    <p className={`font-bold truncate ${dark ? 'text-gray-200' : 'text-slate-800'}`}>{r.content.slice(0, 60)}</p>
                    <p className={`${dark ? 'text-gray-500' : 'text-slate-400'} mt-0.5`}>{new Date(r.created_at).toLocaleString('fr-FR')}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* New conv panel */}
        {showNewConv && currentRole !== 'admin' && adminId && (
          <div className={`p-3 border-b ${dark ? 'border-gray-700 bg-gray-800' : 'border-slate-100 bg-white'}`}>
            <div className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold shrink-0">A</div>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Administration</p>
                <p className={`text-xs ${dark ? 'text-gray-400' : 'text-slate-400'}`}>Contacter l&apos;administration</p>
              </div>
              <button onClick={() => startNewConversation({ id: adminId, nom: 'Administration', role: 'admin' })} className="ml-auto bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition shadow-sm">Démarrer</button>
            </div>
          </div>
        )}

        {showNewConv && currentRole === 'admin' && (
          <div className={`p-3 border-b ${dark ? 'border-gray-700 bg-gray-800' : 'border-slate-100 bg-white'}`}>
            <input type="text" value={searchTerm} onChange={e => searchUsers(e.target.value)} placeholder="Rechercher un utilisateur..." autoFocus
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${dark ? 'bg-gray-700 border-gray-600 text-white' : 'border-slate-200'}`} />
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1">
                {searchResults.map(u => (
                  <button key={u.id} onClick={() => startNewConversation(u)} className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center gap-2 ${dark ? 'hover:bg-gray-700' : 'hover:bg-blue-50'}`}>
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">{u.nom.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${dark ? 'text-gray-200' : 'text-slate-800'}`}>{u.nom}</p>
                      <p className={`text-[10px] capitalize ${dark ? 'text-gray-500' : 'text-slate-400'}`}>{u.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {visibleConversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className={`text-sm italic font-medium mb-4 ${dark ? 'text-gray-400' : 'text-slate-400'}`}>
                {currentRole === 'admin' ? 'Aucune conversation' : 'Aucune discussion'}
              </p>
              {currentRole !== 'admin' && adminId && (
                <button onClick={() => setShowNewConv(true)} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm">+ Nouvelle discussion</button>
              )}
            </div>
          ) : (
            visibleConversations.map(c => (
              <button key={c.otherId} onClick={() => { setSelectedConv(c); setShowProfile(false); setShowMsgSearch(false); setMsgSearchResults([]); }}
                className={`w-full text-left px-4 py-3 border-b transition ${dark ? 'border-gray-700' : 'border-slate-50'} ${
                  selectedConv?.otherId === c.otherId ? (dark ? 'bg-gray-700 border-l-2 border-l-blue-500' : 'bg-blue-50 border-l-2 border-l-blue-500') : (dark ? 'hover:bg-gray-700/50' : 'hover:bg-white')
                }`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      c.otherRole === 'admin' ? 'bg-amber-100 text-amber-700' : c.otherRole === 'entreprise' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>{c.otherNom.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`font-bold text-sm truncate ${dark ? 'text-white' : 'text-slate-900'}`}>{c.otherNom}</p>
                        {c.closed && <span className="text-[9px] bg-slate-200 dark:bg-gray-600 text-slate-500 dark:text-gray-300 px-1.5 py-0.5 rounded-full font-bold">Fermée</span>}
                      </div>
                      <p className={`text-xs truncate ${dark ? 'text-gray-400' : 'text-slate-400'}`}>{c.lastMessage || 'Démarrer'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.unread > 0 && <span className="bg-blue-600 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">{c.unread}</span>}
                    {c.lastDate && <p className={`text-[10px] mt-1 ${dark ? 'text-gray-500' : 'text-slate-400'}`}>{new Date(c.lastDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</p>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${dark ? 'border-gray-700 bg-gray-800' : 'border-slate-100 bg-white'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  selectedConv.otherRole === 'admin' ? 'bg-amber-100 text-amber-700' : selectedConv.otherRole === 'entreprise' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>{selectedConv.otherNom.charAt(0).toUpperCase()}</div>
                <div>
                  <h3 className={`font-black tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{selectedConv.otherNom}</h3>
                  <p className={`text-xs font-medium capitalize ${dark ? 'text-gray-400' : 'text-slate-400'}`}>
                    {selectedConv.otherRole === 'admin' ? 'Administrateur' : selectedConv.otherRole === 'entreprise' ? 'Entreprise' : 'Secrétaire'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {currentRole === 'admin' && (
                  <button onClick={() => loadProfile(selectedConv.otherId)} className={`text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${dark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    <span>🪪</span><span>Profil</span>
                  </button>
                )}
                <button onClick={() => exportConversation('csv')} className={`text-xs font-bold px-2 py-2 rounded-lg transition ${dark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`} title="Exporter CSV">📥 CSV</button>
                <button onClick={() => exportConversation('pdf')} className={`text-xs font-bold px-2 py-2 rounded-lg transition ${dark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`} title="Exporter PDF">📄 PDF</button>
                {selectedConv.closed ? (
                  <button onClick={() => reopenConversation(selectedConv.otherId)} className="text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-2 rounded-lg transition">🔓 Rouvrir</button>
                ) : (
                  <button onClick={() => closeConversation(selectedConv.otherId)} className="text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg transition">🗄️ Fermer</button>
                )}
              </div>
            </div>

            {selectedConv.closed && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 px-4 py-2 flex items-center justify-between">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Cette discussion a été fermée.</p>
                <button onClick={() => reopenConversation(selectedConv.otherId)} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition">Rouvrir</button>
              </div>
            )}

            {/* Messages */}
            <div ref={messagesContainerRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onTouchStart={swipeStart} onTouchMove={swipeMove} onTouchEnd={swipeEnd} className={`flex-1 overflow-y-auto p-4 space-y-3 transition-colors ${dragOver ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-300 dark:ring-blue-600' : (dark ? 'bg-gray-900/50' : 'bg-gradient-to-b from-slate-50/50 to-white')}`} style={{ transform: swipeOffset > 0 ? `translateX(${Math.min(swipeOffset * 0.3, 30)}px)` : swipeOffset < 0 ? `translateX(${Math.max(swipeOffset * 0.3, -30)}px)` : undefined }}>
              {messages.length >= PAGE_SIZE && (
                <button onClick={loadOlder} disabled={loadingOlder} className={`mx-auto block text-xs font-bold px-4 py-1.5 rounded-full transition ${dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {loadingOlder ? 'Chargement...' : `Charger plus ↑`}
                </button>
              )}
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-gray-500">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-3xl mb-3">💬</div>
                  <p className="font-medium text-sm">Commencez la conversation</p>
                  <p className="text-xs text-slate-300 dark:text-gray-600 mt-1">Envoyez votre premier message</p>
                </div>
              ) : (
                filteredMessages.map(m => {
                  const isMine = m.sender_id === currentUserId;
                  const isExpired = m.ephemeral && m.expires_at && new Date(m.expires_at) < new Date();
                  if (isExpired) return null;

                  if (m.deleted) {
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm italic ${dark ? 'bg-gray-700 text-gray-400' : 'bg-slate-100 text-slate-400'}`}>
                          <p>🗑️ Message supprimé</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>
                            {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const replyMsg = m.reply_to ? messages.find(rm => rm.id === m.reply_to) : null;
                  const reactionEntries = m.reactions ? Object.entries(m.reactions).filter(([, users]) => users.length > 0) : [];

                  return (
                    <div key={m.id} className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {/* Pinned indicator */}
                      {m.pinned && (
                        <div className={`text-[10px] font-bold mb-0.5 px-2 py-0.5 rounded-full ${dark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>📌 Épinglé</div>
                      )}

                      {/* Reply-to preview */}
                      {replyMsg && !replyMsg.deleted && (
                        <div className={`text-[10px] px-3 py-1.5 rounded-t-xl border-b-0 max-w-[70%] truncate ${dark ? 'bg-gray-600 text-gray-300 border-l-2 border-l-blue-400' : 'bg-slate-100 text-slate-500 border-l-2 border-l-blue-400'}`}>
                          ↩ {replyMsg.content.slice(0, 60)}
                        </div>
                      )}

                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm font-medium relative ${
                        isMine
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : (dark ? 'bg-gray-700 text-gray-100 border border-gray-600 rounded-bl-md' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md shadow-sm')
                      }`}>
                        {/* File attachment */}
                        {m.file_url && (
                          <div className="mb-2">
                            {m.file_type?.startsWith('image/') ? (
                              <img src={m.file_url} alt={m.file_name || 'Image'} className="rounded-lg max-w-full max-h-48 object-cover" />
                            ) : m.file_type?.startsWith('audio/') ? (
                              <audio controls src={m.file_url} className="max-w-full h-8" />
                            ) : (
                              <a href={m.file_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded-lg ${isMine ? 'bg-blue-500' : (dark ? 'bg-gray-600' : 'bg-slate-100')}`}>
                                <span className="text-lg">📎</span>
                                <span className="text-xs font-bold truncate">{m.file_name}</span>
                              </a>
                            )}
                          </div>
                        )}

                        {editingMsg?.id === m.id ? (
                          <div className="flex gap-1">
                            <input type="text" value={editContent} onChange={e => setEditContent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingMsg(null); }}
                              className={`flex-1 rounded px-2 py-1 text-sm outline-none ${dark ? 'bg-gray-600 text-white' : 'bg-white text-slate-900'}`} autoFocus />
                            <button onClick={saveEdit} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">✓</button>
                            <button onClick={() => setEditingMsg(null)} className="text-xs font-bold text-red-400 hover:text-red-300">✕</button>
                          </div>
                        ) : (
                          <>
                            {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                            <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? 'text-blue-200' : (dark ? 'text-gray-400' : 'text-slate-400')}`}>
                              {m.ephemeral && <span className="text-[9px] mr-1 opacity-70">⏱️</span>}
                              <p className="text-[10px]">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                              {renderTicks(m)}
                            </div>
                          </>
                        )}

                        {/* Hover action buttons */}
                        <div className="absolute -top-8 right-0 hidden group-hover:flex gap-1 z-10">
                          <button onClick={() => copyMessage(m.content)} className="w-7 h-7 rounded-full bg-white dark:bg-gray-600 shadow flex items-center justify-center text-xs hover:bg-slate-100 dark:hover:bg-gray-500 transition" title="Copier">📋</button>
                          {isFeatureEnabled('replyToMessage') && <button onClick={() => setReplyingTo(m)} className="w-7 h-7 rounded-full bg-white dark:bg-gray-600 shadow flex items-center justify-center text-xs hover:bg-slate-100 dark:hover:bg-gray-500 transition" title="Répondre">↩️</button>}
                          {isFeatureEnabled('emojiPicker') && <button onClick={() => setShowEmoji(showEmoji === m.id ? false : m.id)} className="w-7 h-7 rounded-full bg-white dark:bg-gray-600 shadow flex items-center justify-center text-xs hover:bg-slate-100 dark:hover:bg-gray-500 transition" title="Réagir">😊</button>}
                          {isFeatureEnabled('editableMessages') && isMine && <button onClick={() => startEdit(m)} className="w-7 h-7 rounded-full bg-white dark:bg-gray-600 shadow flex items-center justify-center text-xs hover:bg-slate-100 dark:hover:bg-gray-500 transition" title="Modifier">✏️</button>}
                          {isFeatureEnabled('pinMessages') && isMine && <button onClick={() => pinMessage(m.id)} className={`w-7 h-7 rounded-full shadow flex items-center justify-center text-xs transition ${m.pinned ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-white dark:bg-gray-600 hover:bg-slate-100 dark:hover:bg-gray-500'}`} title={m.pinned ? 'Désépingler' : 'Épingler'}>📌</button>}
                        </div>

                        {/* Emoji picker popup */}
                        {showEmoji === m.id && (
                          <div className={`absolute -top-12 right-0 flex gap-1 p-1.5 rounded-xl shadow-xl z-20 ${dark ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-slate-200'}`}>
                            {EMOJI_LIST.map(e => (
                              <button key={e} onClick={() => addReaction(m.id, e)} className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-gray-600 flex items-center justify-center text-sm transition">{e}</button>
                            ))}
                          </div>
                        )}

                        {/* Delete button */}
                        {(isMine || currentRole === 'admin') && (
                          <button onClick={() => deleteMessage(m.id)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center" title="Supprimer">✕</button>
                        )}
                      </div>

                      {/* Reactions */}
                      {reactionEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5 px-1">
                          {reactionEntries.map(([emoji, users]) => (
                            <button key={emoji} onClick={() => addReaction(m.id, emoji)}
                              className={`text-xs px-1.5 py-0.5 rounded-full border transition ${users.includes(currentUserId) ? (dark ? 'bg-blue-900/40 border-blue-500 text-blue-300' : 'bg-blue-50 border-blue-300 text-blue-600') : (dark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-600')}`}>
                              {emoji} {users.length}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {typingText && (
                <div className="flex items-center gap-2 px-2">
                  <div className="flex gap-1">
                    <span className={`w-2 h-2 rounded-full animate-bounce ${dark ? 'bg-gray-400' : 'bg-slate-400'}`} style={{ animationDelay: '0ms' }} />
                    <span className={`w-2 h-2 rounded-full animate-bounce ${dark ? 'bg-gray-400' : 'bg-slate-400'}`} style={{ animationDelay: '150ms' }} />
                    <span className={`w-2 h-2 rounded-full animate-bounce ${dark ? 'bg-gray-400' : 'bg-slate-400'}`} style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className={`text-xs ${dark ? 'text-gray-400' : 'text-slate-400'}`}>{typingText} écrit...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Ephemeral selector */}
            {ephemeralMode !== null && (
              <div className={`px-4 py-1.5 text-xs font-bold flex items-center gap-2 ${dark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-50 text-purple-600'}`}>
                <span>⏱️ Message éphémère : {EPHEMERAL_OPTIONS.find(o => o.ms === ephemeralMode)?.label}</span>
                <button onClick={() => setEphemeralMode(null)} className="ml-auto text-purple-400 hover:text-purple-600">✕</button>
              </div>
            )}

            {/* Input */}
            {!selectedConv.closed ? (
              <div className={`p-4 border-t relative ${dark ? 'border-gray-700 bg-gray-800' : 'border-slate-100 bg-white'}`}>
                {/* Mention search dropdown */}
                {showMentions && mentionUsers.length > 0 && (
                  <div className={`absolute bottom-full left-4 mb-1 w-64 rounded-xl shadow-xl border overflow-hidden z-20 ${dark ? 'bg-gray-700 border-gray-600' : 'bg-white border-slate-200'}`}>
                    {mentionUsers.map(u => (
                      <button key={u.id} onClick={() => insertMention(u)} className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition ${dark ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-slate-50 text-slate-800'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : u.role === 'entreprise' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{u.nom.charAt(0)}</span>
                        <span className="font-semibold">{u.nom}</span>
                        <span className={`text-xs capitalize ${dark ? 'text-gray-400' : 'text-slate-400'}`}>{u.role}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Reply-to indicator */}
                {replyingTo && (
                  <div className={`mb-2 px-3 py-2 rounded-t-xl border-l-2 border-l-blue-400 flex items-center justify-between text-xs ${dark ? 'bg-gray-700 text-gray-300' : 'bg-slate-50 text-slate-500'}`}>
                    <span className="truncate">↩ Réponse à {replyingTo.content.slice(0, 50)}</span>
                    <button onClick={() => setReplyingTo(null)} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 font-bold">✕</button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" />
                  <button onClick={() => fileInputRef.current?.click()} className={`p-2.5 rounded-xl transition ${dark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`} title="Joindre un fichier">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>

                  {/* Voice recording */}
                  {isFeatureEnabled('voiceMessages') && (
                    recording ? (
                      <button onClick={() => { stopRecording(); sendAudio(); }} className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 transition animate-pulse" title="Arrêter et envoyer">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                      </button>
                    ) : (
                      <button onClick={startRecording} className={`p-2.5 rounded-xl transition ${dark ? 'bg-gray-700 hover:bg-gray-600 text-gray-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`} title="Message vocal">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      </button>
                    )
                  )}

                  <div className="relative">
                    <button onClick={() => setEphemeralMode(ephemeralMode === null ? EPHEMERAL_OPTIONS[0].ms : EPHEMERAL_OPTIONS[(EPHEMERAL_OPTIONS.findIndex(o => o.ms === ephemeralMode) + 1) % EPHEMERAL_OPTIONS.length].ms)}
                      className={`p-2.5 rounded-xl transition ${ephemeralMode !== null ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300' : (dark ? 'bg-gray-700 hover:bg-gray-600 text-gray-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500')}`} title="Mode éphémère">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>

                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={e => { setNewMessage(e.target.value); handleTyping(); const val = e.target.value; const atIdx = val.lastIndexOf('@'); if (atIdx >= 0 && atIdx === val.length - 1 || (atIdx >= 0 && !val.slice(atIdx).includes(' '))) { searchMentions(val.slice(atIdx + 1)); } else { setShowMentions(false); } }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !showMentions) { e.preventDefault(); sendMessage(); } }}
                    placeholder={editingMsg ? 'Modifier le message...' : replyingTo ? 'Répondre...' : 'Écrivez votre message...'}
                    rows={1}
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none ${dark ? 'bg-gray-700 border-gray-600 text-white' : 'border-slate-200'}`}
                  />
                  <button onClick={editingMsg ? saveEdit : sendMessage} disabled={(!newMessage.trim() && !editingMsg) || sending}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
                    aria-label={editingMsg ? 'Modifier' : 'Envoyer'}>
                    {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> :
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                    }
                  </button>
                </div>
              </div>
            ) : (
              <div className={`p-4 border-t text-center ${dark ? 'border-gray-700 bg-gray-800' : 'border-slate-100 bg-slate-50'}`}>
                <p className={`text-xs font-medium ${dark ? 'text-gray-400' : 'text-slate-400'}`}>Discussion fermée</p>
              </div>
            )}
          </>
        ) : (
          <div className={`flex-1 flex items-center justify-center ${dark ? 'bg-gray-800' : 'bg-gradient-to-b from-slate-50/30 to-white'}`}>
            <div className="text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 ${dark ? 'bg-gray-700' : 'bg-slate-100'}`}>💬</div>
              <p className={`font-bold text-lg tracking-tight ${dark ? 'text-gray-300' : 'text-slate-500'}`}>
                {currentRole === 'admin' ? 'Sélectionnez une conversation' : 'Vos discussions'}
              </p>
              <p className={`text-sm mt-1 ${dark ? 'text-gray-500' : 'text-slate-400'}`}>
                {currentRole === 'admin' ? 'Choisissez un utilisateur ou démarrez une nouvelle discussion' : 'Contactez l\'administration pour toute question'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Drawer */}
      {showProfile && activeProfile && (
        <div className={`w-80 border-l flex flex-col p-6 shadow-xl ${dark ? 'border-gray-700 bg-gray-800' : 'border-slate-200 bg-white'}`}>
          <div className={`flex justify-between items-center mb-6 border-b pb-4 ${dark ? 'border-gray-700' : 'border-slate-100'}`}>
            <h3 className={`font-black text-base ${dark ? 'text-white' : 'text-slate-900'}`}>Coordonnées</h3>
            <button onClick={() => setShowProfile(false)} className={`${dark ? 'text-gray-400 hover:text-gray-200' : 'text-slate-400 hover:text-slate-600'} font-bold p-1`}>✕</button>
          </div>
          <div className="flex flex-col items-center text-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeProfile.avatar_url || '/avatar-placeholder.png'} alt={activeProfile.nom} width={72} height={72} className="rounded-full object-cover w-18 h-18 border-2 border-slate-100 dark:border-gray-600 shadow-sm mb-3" />
            <h4 className={`font-bold text-lg ${dark ? 'text-white' : 'text-slate-900'}`}>{activeProfile.nom}</h4>
            <span className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase rounded-full mt-1">{activeProfile.role}</span>
          </div>
          <div className="space-y-4 text-sm flex-1">
            <div className={`p-3 rounded-xl border ${dark ? 'bg-gray-700 border-gray-600' : 'bg-slate-50 border-slate-100'}`}>
              <span className={`block text-xs font-bold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-slate-400'}`}>Email</span>
              <span className={`font-semibold break-all ${dark ? 'text-gray-200' : 'text-slate-800'}`}>{activeProfile.email || 'Non renseigné'}</span>
            </div>
            <div className={`p-3 rounded-xl border ${dark ? 'bg-gray-700 border-gray-600' : 'bg-slate-50 border-slate-100'}`}>
              <span className={`block text-xs font-bold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-slate-400'}`}>Téléphone</span>
              <span className={`font-semibold ${dark ? 'text-gray-200' : 'text-slate-800'}`}>{activeProfile.telephone || 'Non renseigné'}</span>
            </div>
            <div className={`p-3 rounded-xl border ${dark ? 'bg-gray-700 border-gray-600' : 'bg-slate-50 border-slate-100'}`}>
              <span className={`block text-xs font-bold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-slate-400'}`}>Dernière activité</span>
              <span className={`font-semibold ${dark ? 'text-gray-200' : 'text-slate-800'}`}>{getStatusInfo(activeProfile.last_seen).text}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
